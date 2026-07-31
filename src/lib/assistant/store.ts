'use client';

/**
 * The bridge between the pages and the assistant.
 *
 * The site keeps its state where it already lived - the year in a `useState`
 * on two pages, the district in the URL, the simulator sliders inside
 * Simulator.tsx. Rewriting all of that onto a global store to give the
 * assistant a view of it would be a large, risky change to working code for a
 * feature that only needs to read.
 *
 * So this is a deliberately small publish/subscribe module instead. A page
 * calls one hook to publish what it currently shows and to hand over the
 * setters it already has; the assistant reads the snapshot and calls those
 * setters. No new state library, no prop drilling, and if the assistant is
 * never opened none of it costs anything but a couple of object assignments.
 *
 * DOM scraping is avoided on purpose: `data-assistant-section` marks regions
 * for scrolling and highlighting, but every number the model sees comes from
 * React state, not from parsing rendered text.
 */
import { useEffect } from 'react';
import { useSyncExternalStore } from 'react';
import type { SimulatorControlId } from '@/lib/simulator-config';

export type SimulatorSnapshotEntry = {
  id: SimulatorControlId;
  label: string;
  baseline: number;
  value: number;
};

export type SimulatorImpact = {
  stateDollars: number;
  localDollars: number;
  levyAlreadyApproved: number;
  levyNeedsVote: number;
  breakdown: { label: string; amount: number }[];
};

export type AssistantSnapshot = {
  /** Selected school year on whichever page owns one. */
  schoolYear: string | null;
  /** Selected district code, whatever page selected it. */
  districtCode: string | null;
  comparisonCode: string | null;
  simulatorValues: SimulatorSnapshotEntry[] | null;
  simulatorImpact: SimulatorImpact | null;
};

export type AssistantHandlers = {
  setSchoolYear?: (year: string) => void;
  selectDistrict?: (code: string) => void;
  clearDistrict?: () => void;
  setSimulatorControl?: (id: SimulatorControlId, value: number) => void;
  resetSimulator?: () => void;
};

const EMPTY: AssistantSnapshot = {
  schoolYear: null,
  districtCode: null,
  comparisonCode: null,
  simulatorValues: null,
  simulatorImpact: null,
};

let snapshot: AssistantSnapshot = EMPTY;
let handlers: AssistantHandlers = {};
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AssistantSnapshot {
  return snapshot;
}

/*
  Server rendering has no page state to report. Returning the same frozen
  object keeps useSyncExternalStore from looping on a fresh reference.
*/
function getServerSnapshot(): AssistantSnapshot {
  return EMPTY;
}

function shallowEqualEntries(
  a: SimulatorSnapshotEntry[] | null,
  b: SimulatorSnapshotEntry[] | null
) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((entry, i) => entry.id === b[i].id && entry.value === b[i].value);
}

function shallowEqualImpact(a: SimulatorImpact | null, b: SimulatorImpact | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.stateDollars === b.stateDollars &&
    a.localDollars === b.localDollars &&
    a.levyAlreadyApproved === b.levyAlreadyApproved &&
    a.levyNeedsVote === b.levyNeedsVote &&
    a.breakdown.length === b.breakdown.length
  );
}

/**
 * Merge a partial update, emitting only when something genuinely changed.
 * Publishing happens inside effects on every render of the host page, so a
 * naive implementation would notify subscribers constantly.
 */
function publish(patch: Partial<AssistantSnapshot>) {
  const next: AssistantSnapshot = { ...snapshot, ...patch };
  const unchanged =
    next.schoolYear === snapshot.schoolYear &&
    next.districtCode === snapshot.districtCode &&
    next.comparisonCode === snapshot.comparisonCode &&
    shallowEqualEntries(next.simulatorValues, snapshot.simulatorValues) &&
    shallowEqualImpact(next.simulatorImpact, snapshot.simulatorImpact);
  if (unchanged) return;
  snapshot = next;
  emit();
}

export function assistantHandlers(): AssistantHandlers {
  return handlers;
}

function registerHandlers(next: AssistantHandlers) {
  handlers = { ...handlers, ...next };
}

function unregisterHandlers(keys: (keyof AssistantHandlers)[]) {
  const copy = { ...handlers };
  for (const key of keys) delete copy[key];
  handlers = copy;
}

/** Read the current page state. Used by the assistant panel only. */
export function useAssistantSnapshot(): AssistantSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Read outside React (context assembly at send time). */
export function assistantSnapshot(): AssistantSnapshot {
  return snapshot;
}

/**
 * Publish the selected school year and let the assistant change it.
 * Called by the two pages that own a year control.
 */
export function useAssistantYear(year: string, setYear: (year: string) => void) {
  useEffect(() => {
    publish({ schoolYear: year });
  }, [year]);

  useEffect(() => {
    registerHandlers({ setSchoolYear: setYear });
    return () => unregisterHandlers(['setSchoolYear']);
  }, [setYear]);

  useEffect(
    () => () => {
      publish({ schoolYear: null });
    },
    []
  );
}

/** Publish the selected district and let the assistant change it. */
export function useAssistantDistrict(
  code: string | null,
  options: {
    select?: (code: string) => void;
    clear?: () => void;
    comparisonCode?: string | null;
  } = {}
) {
  const { select, clear, comparisonCode = null } = options;

  useEffect(() => {
    publish({ districtCode: code || null, comparisonCode });
  }, [code, comparisonCode]);

  useEffect(() => {
    registerHandlers({ selectDistrict: select, clearDistrict: clear });
    return () => unregisterHandlers(['selectDistrict', 'clearDistrict']);
  }, [select, clear]);

  useEffect(
    () => () => {
      publish({ districtCode: null, comparisonCode: null });
    },
    []
  );
}

/** Publish simulator slider values plus their computed district impact. */
export function useAssistantSimulator(
  values: SimulatorSnapshotEntry[],
  impact: SimulatorImpact | null,
  actions: {
    setControl: (id: SimulatorControlId, value: number) => void;
    reset: () => void;
  }
) {
  const { setControl, reset } = actions;

  useEffect(() => {
    publish({ simulatorValues: values, simulatorImpact: impact });
  }, [values, impact]);

  useEffect(() => {
    registerHandlers({ setSimulatorControl: setControl, resetSimulator: reset });
    return () => unregisterHandlers(['setSimulatorControl', 'resetSimulator']);
  }, [setControl, reset]);

  useEffect(
    () => () => {
      publish({ simulatorValues: null, simulatorImpact: null });
    },
    []
  );
}

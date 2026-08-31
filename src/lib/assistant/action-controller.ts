'use client';

/**
 * Turns a validated action into an actual change on the page.
 *
 * Two rules govern whether an action runs at all.
 *
 * The model is told to emit actions only when the visitor explicitly asked for
 * one. That instruction is necessary but not sufficient - a model that
 * misreads "what would happen if I set the multiplier to 2?" as a command
 * would silently rewrite the visitor's simulator. So the decision is made
 * again here, from the visitor's own words: anything that changes state has to
 * clear an imperative check, and anything that does not clear it is offered as
 * a button instead of being performed. The failure mode is one extra click,
 * never an unrequested change.
 *
 * Scrolling and highlighting are exempt: they move the viewport, not the data.
 */
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { AssistantAction } from '@/lib/assistant/types';
import { assistantHandlers } from '@/lib/assistant/store';
import { assistantSource } from '@/lib/assistant/knowledge';
import { districtPath } from '@/lib/district-slug';
import { simulatorControl } from '@/lib/simulator-config';
import { requestsAction, shouldAutoRun } from '@/lib/assistant/intent';
import type { AssistantStrings } from '@/lib/assistant/i18n';

// Re-exported so callers have one import for action handling.
export { requestsAction, shouldAutoRun };

const HIGHLIGHT_CLASS = 'assistant-highlight';
const HIGHLIGHT_MS = 2_200;

function sectionElement(sectionId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-assistant-section="${sectionId}"]`);
}

function scrollToSection(sectionId: string): boolean {
  const element = sectionElement(sectionId);
  if (!element) return false;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  element.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  return true;
}

function highlightSection(sectionId: string): boolean {
  const element = sectionElement(sectionId);
  if (!element) return false;
  scrollToSection(sectionId);
  element.classList.add(HIGHLIGHT_CLASS);
  window.setTimeout(() => element.classList.remove(HIGHLIGHT_CLASS), HIGHLIGHT_MS);
  return true;
}

export type ActionOutcome = {
  /** Whether the page actually changed. */
  ok: boolean;
  /** Short past-tense confirmation, already in the visitor's language. */
  label: string;
};

/**
 * The page name for a route, in the visitor's language.
 */
function routeLabel(route: string, strings: AssistantStrings): string {
  switch (route) {
    case '/':
      return strings.pageHome;
    case '/districts':
      return strings.pageDistricts;
    case '/simulator':
      return strings.pageSimulator;
    case '/take-action':
      return strings.pageTakeAction;
    case '/sources':
      return strings.pageSources;
    case '/lea':
      return strings.pageLea;
    default:
      return route;
  }
}

/**
 * A readable name for a page region.
 *
 * Reads the region's own heading out of the DOM rather than translating
 * eighteen section IDs into seven languages. The heading is already on screen
 * and already translated by the site's dictionary, so it is both correct and
 * in the right language for free. Falls back to the humanised ID when the
 * region is not mounted.
 */
function sectionLabel(sectionId: string): string {
  if (typeof document !== 'undefined') {
    const element = sectionElement(sectionId);
    const heading = element?.querySelector('h1, h2, h3');
    const text = heading?.textContent?.replace(/\s+/g, ' ').trim();
    if (text && text.length <= 80) return text;
  }
  return sectionId.replace(/-/g, ' ');
}

function fill(template: string, x: string, y?: string): string {
  return template.replace('{x}', x).replace('{y}', y ?? '');
}

/**
 * Human-readable label for an action, in the visitor's language. Used both for
 * the "Done" confirmations and for the buttons offered when an action was not
 * auto-run.
 */
export function describeAction(
  action: AssistantAction,
  districtName: (code: string) => string,
  strings: AssistantStrings
): string {
  switch (action.type) {
    case 'navigate':
      return fill(strings.actionGoTo, routeLabel(action.route, strings));
    case 'scroll_to_section':
      return fill(strings.actionScroll, sectionLabel(action.sectionId));
    case 'highlight_section':
      return fill(strings.actionHighlight, sectionLabel(action.sectionId));
    case 'select_district':
      return fill(strings.actionSelectDistrict, districtName(action.districtCode));
    case 'clear_district':
      return strings.actionClearDistrict;
    case 'set_school_year':
      return fill(strings.actionSetYear, action.year);
    case 'set_simulator_control': {
      const control = simulatorControl(action.controlId);
      const value =
        control?.kind === 'multiplier'
          ? action.value.toFixed(2)
          : control?.kind === 'hours'
            ? `${action.value.toFixed(2)} hours/week`
            : `$${Math.round(action.value).toLocaleString('en-US')}`;
      return fill(strings.actionSetControl, control?.label ?? action.controlId, value);
    }
    case 'reset_simulator':
      return strings.actionReset;
    case 'open_source': {
      const source = assistantSource(action.sourceId);
      return fill(strings.actionOpenSource, source?.label ?? action.sourceId);
    }
    default:
      return '';
  }
}

/**
 * Executes actions. Returns a hook because navigation needs the App Router -
 * the assistant uses the same client-side navigation as every link on the
 * site, rather than assigning to window.location, so React state survives.
 */
export function useActionRunner() {
  const router = useRouter();

  return useCallback(
    (
      action: AssistantAction,
      districtName: (code: string) => string,
      strings: AssistantStrings
    ): ActionOutcome => {
      const label = describeAction(action, districtName, strings);
      const handlers = assistantHandlers();

      switch (action.type) {
        case 'navigate':
          router.push(action.route);
          return { ok: true, label };

        case 'scroll_to_section':
          return { ok: scrollToSection(action.sectionId), label };

        case 'highlight_section':
          return { ok: highlightSection(action.sectionId), label };

        case 'select_district': {
          if (!handlers.selectDistrict) {
            /*
              No page currently owns a district picker - the visitor is on
              Sources, say. Send them to the district's own page, which is a
              readable URL naming the district rather than its OSPI code, and
              is the whole profile rather than the Explorer's charts view.
            */
            router.push(districtPath(action.districtCode));
            return { ok: true, label };
          }
          handlers.selectDistrict(action.districtCode);
          return { ok: true, label };
        }

        case 'clear_district': {
          if (!handlers.clearDistrict) return { ok: false, label };
          handlers.clearDistrict();
          return { ok: true, label };
        }

        case 'set_school_year': {
          if (!handlers.setSchoolYear) return { ok: false, label };
          handlers.setSchoolYear(action.year);
          return { ok: true, label };
        }

        case 'set_simulator_control': {
          if (!handlers.setSimulatorControl) {
            // The simulator is not mounted, so there is nothing to set. Send
            // the visitor there rather than silently dropping the request.
            router.push('/simulator');
            return { ok: false, label };
          }
          handlers.setSimulatorControl(action.controlId, action.value);
          return { ok: true, label };
        }

        case 'reset_simulator': {
          if (!handlers.resetSimulator) return { ok: false, label };
          handlers.resetSimulator();
          return { ok: true, label };
        }

        case 'open_source': {
          const source = assistantSource(action.sourceId);
          if (!source) return { ok: false, label };
          if (source.type === 'internal') {
            router.push(source.url);
            return { ok: true, label };
          }
          // External links are opened only from the resolved allow-list URL,
          // never from anything the model produced.
          window.open(source.url, '_blank', 'noopener,noreferrer');
          return { ok: true, label };
        }

        default:
          return { ok: false, label };
      }
    },
    [router]
  );
}

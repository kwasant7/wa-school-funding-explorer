'use client';

/**
 * Browser-side conversation persistence.
 *
 * sessionStorage, never localStorage: a conversation should survive an
 * accidental reload or a click through to another page, and then be gone. The
 * visitor ID lives there too, which is a deliberate tradeoff - a persistent ID
 * would give the Worker a longer rate-limit window, but a random identifier
 * that outlives the browsing session is a tracking ID, and this site does not
 * set one. The Worker applies a second, coarser limit to cover the gap.
 */
import type { AssistantTurn } from '@/lib/assistant/types';

const TURNS_KEY = 'wa-assistant-turns';
const VISITOR_KEY = 'wa-assistant-visitor';
const MAX_STORED_TURNS = 40;

function randomId(): string {
  const webCrypto: Crypto | undefined =
    typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }
  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    const bytes = webCrypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte: number) =>
      byte.toString(16).padStart(2, '0')
    ).join('');
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newTurnId(): string {
  return randomId();
}

/**
 * A random per-session identifier used only as a rate-limit key. It is not
 * derived from anything about the visitor and is never sent anywhere else.
 */
export function visitorId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = window.sessionStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const created = randomId();
    window.sessionStorage.setItem(VISITOR_KEY, created);
    return created;
  } catch {
    // Private-mode Safari and blocked storage: fall back to a per-load value.
    return randomId();
  }
}

export function loadTurns(): AssistantTurn[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(TURNS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (turn): turn is AssistantTurn =>
        Boolean(turn) &&
        typeof turn === 'object' &&
        typeof (turn as AssistantTurn).id === 'string' &&
        typeof (turn as AssistantTurn).text === 'string' &&
        ((turn as AssistantTurn).role === 'user' ||
          (turn as AssistantTurn).role === 'assistant')
    );
  } catch {
    return [];
  }
}

export function saveTurns(turns: AssistantTurn[]) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      TURNS_KEY,
      JSON.stringify(turns.slice(-MAX_STORED_TURNS))
    );
  } catch {
    // Storage full or blocked; the conversation still works in memory.
  }
}

export function clearTurns() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(TURNS_KEY);
  } catch {
    // Nothing to do - the caller clears in-memory state regardless.
  }
}

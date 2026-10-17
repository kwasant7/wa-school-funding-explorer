'use client';

/**
 * The site guide: launcher, dialog, and the conversation loop.
 *
 * Mounted once in the root layout so it is available on every page. It holds
 * no data of its own - the page context is assembled at send time from the
 * assistant store, and retrieval runs locally against the bundled knowledge -
 * so opening it on a page that publishes nothing still produces a useful
 * answer about the site itself.
 *
 * Layout is one component for both breakpoints rather than two trees: a
 * bottom-right panel from `md` up, a near-full-height sheet below it. Keeping
 * one tree means focus management, the live region, and the abort controller
 * have a single implementation.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import AssistantComposer from '@/components/assistant/AssistantComposer';
import AssistantMessage from '@/components/assistant/AssistantMessage';
import AssistantSuggestions from '@/components/assistant/AssistantSuggestions';
import { assistantStrings, starterKeyForPath, starterQuestions } from '@/lib/assistant/i18n';
import { useAssistantLanguage } from '@/lib/assistant/use-language';
import {
  buildContext,
  districtHistoryContext,
  extraDistrictContext,
} from '@/lib/assistant/context';
import { retrieve } from '@/lib/assistant/retrieval';
import { sourceCatalogue } from '@/lib/assistant/knowledge';
import { isAssistantConfigured, sendChat } from '@/lib/assistant/client';
import { clearTurns, loadTurns, newTurnId, saveTurns, visitorId } from '@/lib/assistant/storage';
import { shouldAutoRun, useActionRunner, describeAction } from '@/lib/assistant/action-controller';
import { assistantSnapshot } from '@/lib/assistant/store';
import type {
  AssistantAction,
  AssistantChatMessage,
  AssistantTurn,
} from '@/lib/assistant/types';
import districtsData from '@/data/districts.json';

/** Recent turns sent as history. Older context is dropped, oldest first. */
const HISTORY_TURNS = 8;
const HISTORY_CHARS = 4_000;

/**
 * Markdown stripped down to speech.
 *
 * The live region is read aloud, and raw Markdown is not: "**levy cap**" and
 * "[Policy Simulator](/simulator)" become noise in a screen reader. The
 * visible bubble still renders the real formatting; this is only what gets
 * announced.
 */
function toSpeech(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*\u2022]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function districtName(code: string): string {
  return districtsData.districts.find((d) => d.code === code)?.name ?? code;
}

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9z" />
      <path d="M18.5 15.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-4.5 w-4.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

/**
 * `initialOpen` exists for AssistantLauncher, which renders a stand-in button
 * and only then loads this module. Without it the visitor's first click would
 * merely mount a closed assistant and they would have to click again.
 */
/**
 * Actions that change what the page is showing run before actions that change
 * a value on it. Anything not named here keeps its position after both.
 */
const ACTION_ORDER: Partial<Record<AssistantAction['type'], number>> = {
  navigate: 0,
  select_district: 1,
  clear_district: 1,
  set_school_year: 2,
};

function actionOrder(type: AssistantAction['type']): number {
  return ACTION_ORDER[type] ?? 3;
}

export default function FundingAssistant({ initialOpen = false }: { initialOpen?: boolean }) {
  const pathname = usePathname();
  const language = useAssistantLanguage();
  const strings = assistantStrings(language);
  const runAction = useActionRunner();

  const [open, setOpen] = useState(initialOpen);
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [liveMessage, setLiveMessage] = useState('');
  /*
    The one answer currently typing itself in. Held as an id rather than a
    flag on the turn so that reopening the panel, or restoring the
    conversation from this session's storage, shows every earlier answer
    already written out - replaying them would be a lie about when they
    arrived.
  */
  const [revealTurnId, setRevealTurnId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const lastQuestionRef = useRef<string>('');

  const configured = isAssistantConfigured();

  // Restore this session's conversation once, on the client.
  useEffect(() => {
    setTurns(loadTurns());
  }, []);

  useEffect(() => {
    if (turns.length > 0) saveTurns(turns);
  }, [turns]);

  const pinToBottom = useCallback(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, []);

  // Keep the newest message in view as answers arrive. An answer that is
  // still revealing itself also calls this on every frame it grows, since
  // `turns` does not change while that happens.
  useEffect(() => {
    if (!open) return;
    pinToBottom();
  }, [turns, busy, open, pinToBottom]);

  /*
    Focus handling for the dialog: move focus in on open, restore it to the
    launcher on close, close on Escape, and keep Tab inside while it is open.
    The sheet covers the page on small screens, so a loose focus ring would
    leave keyboard users tabbing through content they cannot see.
  */
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const input = panelRef.current?.querySelector<HTMLElement>('#assistant-input');
    input?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      /*
        Restore focus to wherever it was, but only if that is still a real
        target. It often is not: opening from a programmatic click, or from an
        element that has since unmounted, leaves `document.body` as the active
        element, and focusing the body silently drops the keyboard user at the
        top of the page. The launcher is the correct fallback - it is where
        they would expect to land after closing.
      */
      const restoreTo =
        previouslyFocused &&
        previouslyFocused !== document.body &&
        previouslyFocused.isConnected &&
        typeof previouslyFocused.focus === 'function'
          ? previouslyFocused
          : launcherRef.current;
      restoreTo?.focus?.();
    };
  }, [open]);

  /*
    Lock the page behind the mobile sheet only. On desktop the panel is a
    floating card and the page should still scroll normally underneath.
  */
  useEffect(() => {
    if (!open) return;
    const isSheet = window.matchMedia('(max-width: 767px)').matches;
    if (!isSheet) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Abandon any in-flight request if the assistant unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  const starters = useMemo(
    () => starterQuestions(language, starterKeyForPath(pathname)),
    [language, pathname]
  );

  const latestSuggestions = useMemo(() => {
    for (let i = turns.length - 1; i >= 0; i -= 1) {
      const turn = turns[i];
      if (turn.role === 'assistant' && turn.suggestedQuestions?.length) {
        return turn.suggestedQuestions;
      }
    }
    return [];
  }, [turns]);

  const performAction = useCallback(
    (action: AssistantAction) => {
      const outcome = runAction(action, districtName, strings);
      if (!outcome.ok) {
        setLiveMessage(strings.errorActionRefused);
        return;
      }
      setLiveMessage(`${strings.performed}: ${outcome.label}`);
      // Navigating or selecting a district usually means the visitor wants to
      // look at the page, so get the sheet out of the way on small screens.
      if (
        window.matchMedia('(max-width: 767px)').matches &&
        action.type !== 'highlight_section'
      ) {
        setOpen(false);
      }
    },
    [runAction, strings]
  );

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || busy) return;

      lastQuestionRef.current = trimmed;
      setDraft('');
      setBusy(true);
      setLiveMessage(strings.loading);

      const userTurn: AssistantTurn = {
        id: newTurnId(),
        role: 'user',
        text: trimmed,
        createdAt: Date.now(),
      };
      // Snapshot the history before the new question joins it.
      const priorTurns = turns;
      setTurns((current) => [...current, userTurn]);

      const controller = new AbortController();
      abortRef.current = controller;

      const retrieved = retrieve(trimmed);
      const snapshot = assistantSnapshot();

      /*
        A district named in the question but not selected still gets its real
        figures attached, so "how does Yakima compare?" is answered from data
        rather than declined.
      */
      const namedDistricts = retrieved.districts.filter(
        (entry) => entry.code !== snapshot.districtCode
      );
      const namedDistrict = namedDistricts[0];
      const context = buildContext({
        pathname,
        language,
        extraDistrictCode: namedDistrict?.code ?? null,
      });
      if (namedDistrict && context.district?.code !== namedDistrict.code) {
        const extra = extraDistrictContext(namedDistrict.code, context.schoolYear);
        if (extra && !context.district) {
          context.district = extra;
          // Its year-by-year figures have to follow it, or a follow-up about
          // another year lands back on "this page only has one year".
          context.districtHistory = districtHistoryContext(extra.code);
        }
      }
      /*
        Washington has two East Valleys and two West Valleys, told apart only
        by a parenthetical county. A visitor naming the shared part means one
        of the pair, so the second one goes in the comparison slot with its own
        figures - the model can then ask which they meant instead of picking a
        district and quoting the wrong district's money.
      */
      const second = namedDistricts.find(
        (entry) =>
          entry.code !== context.district?.code &&
          entry.code !== context.comparisonDistrict?.code
      );
      if (second && !context.comparisonDistrict) {
        const other = extraDistrictContext(second.code, context.schoolYear);
        if (other) {
          context.comparisonDistrict = other;
          context.comparisonDistrictHistory = districtHistoryContext(other.code);
        }
      }

      let history: AssistantChatMessage[] = priorTurns
        .filter((turn) => !turn.error && turn.text)
        .slice(-HISTORY_TURNS)
        .map((turn) => ({ role: turn.role, content: turn.text }));
      // Trim oldest-first until the history fits the character budget.
      while (
        history.length > 1 &&
        history.reduce((sum, entry) => sum + entry.content.length, 0) > HISTORY_CHARS
      ) {
        history = history.slice(1);
      }

      const outcome = await sendChat(
        {
          message: trimmed,
          language,
          visitorId: visitorId(),
          context,
          knowledge: retrieved.chunks,
          availableSources: sourceCatalogue(),
          history,
        },
        controller.signal
      );

      abortRef.current = null;
      setBusy(false);

      if (!outcome.ok) {
        // A visitor-initiated cancel is not an error worth rendering.
        if (outcome.error.code === 'aborted') {
          setLiveMessage('');
          return;
        }
        setTurns((current) => [
          ...current,
          {
            id: newTurnId(),
            role: 'assistant',
            text: outcome.error.message,
            error: outcome.error,
            createdAt: Date.now(),
          },
        ]);
        setLiveMessage(outcome.error.message);
        return;
      }

      const { response } = outcome;
      const performed: string[] = [];
      const offered: { label: string; action: AssistantAction }[] = [];

      /*
        Selecting a district on the simulator resets every slider - a plan
        belongs to the district it was built for. So a district change has to
        happen before any control change in the same reply, or the reset wipes
        the value that was just set and the visitor is told both were applied
        while only one survived. Same for the year, which reloads the figures a
        control reads from.
      */
      const ordered = [...response.actions].sort(
        (a, b) => actionOrder(a.type) - actionOrder(b.type)
      );

      for (const action of ordered) {
        const label = describeAction(action, districtName, strings);
        if (shouldAutoRun(action, trimmed)) {
          const result = runAction(action, districtName, strings);
          if (result.ok) performed.push(result.label);
          else offered.push({ label, action });
        } else {
          offered.push({ label, action });
        }
      }

      const replyId = newTurnId();
      setRevealTurnId(replyId);
      setTurns((current) => [
        ...current,
        {
          id: replyId,
          role: 'assistant',
          text: response.reply,
          sources: response.sources,
          suggestedQuestions: response.suggestedQuestions,
          performed: performed.length ? performed : undefined,
          offered: offered.length ? offered : undefined,
          confidence: response.confidence,
          createdAt: Date.now(),
        },
      ]);
      setLiveMessage(toSpeech(response.reply));
    },
    [busy, language, pathname, runAction, strings, turns]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setLiveMessage('');
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setTurns([]);
    setDraft('');
    setLiveMessage('');
    clearTurns();
  }, []);

  return (
    /*
      The whole subtree opts out of the site's dictionary translation. Replies
      arrive already in the visitor's language, and the static labels here have
      their own translations - letting the text-node swapper loose on either
      would corrupt them.
    */
    <div data-no-translate>
      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? strings.close : strings.open}
        className={`fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-accent-deep/20 bg-accent px-4 py-3 text-white shadow-lg transition-transform duration-150 hover:bg-accent-deep motion-reduce:transition-none md:bottom-6 md:right-6 ${
          open ? 'scale-95 opacity-0 pointer-events-none' : 'hover:scale-[1.03]'
        }`}
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <SparkIcon className="h-5 w-5" />
        <span className="text-sm font-semibold">{strings.title}</span>
      </button>

      {open && (
        <>
          {/* Scrim for the mobile sheet only; the desktop panel floats. */}
          <div
            className="fixed inset-0 z-40 bg-ink/30 md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="assistant-title"
            aria-describedby="assistant-subtitle"
            className="fixed inset-x-0 bottom-0 top-0 z-50 flex flex-col border-line bg-paper md:inset-auto md:bottom-6 md:right-6 md:top-auto md:h-[min(38rem,calc(100vh-6rem))] md:w-[26rem] md:rounded-2xl md:border md:shadow-xl"
          >
            <header className="flex items-start justify-between gap-3 border-b border-line bg-surface px-4 py-3 md:rounded-t-2xl">
              <div className="min-w-0">
                <h2
                  id="assistant-title"
                  className="flex items-center gap-1.5 text-sm font-bold text-ink"
                >
                  <SparkIcon className="h-4 w-4 text-accent" />
                  {strings.title}
                </h2>
                <p id="assistant-subtitle" className="mt-0.5 text-xs text-ink-muted">
                  {strings.subtitle}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {turns.length > 0 && (
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-ink-secondary transition-colors hover:bg-paper hover:text-ink"
                  >
                    {strings.newConversation}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={strings.close}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-secondary transition-colors hover:bg-paper hover:text-ink"
                >
                  <CloseIcon />
                </button>
              </div>
            </header>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto overscroll-contain px-4 py-4"
              aria-label={strings.messagesLabel}
            >
              {turns.length === 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-ink-secondary">{strings.welcome}</p>
                  {configured && (
                    <AssistantSuggestions
                      heading={strings.starters}
                      questions={starters}
                      onPick={(question) => void ask(question)}
                      disabled={busy}
                    />
                  )}
                  {!configured && (
                    <p className="rounded-xl border border-line bg-surface p-3 text-sm text-ink-secondary">
                      {strings.errorNotConfigured}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3.5">
                  {turns.map((turn) => (
                    <AssistantMessage
                      key={turn.id}
                      turn={turn}
                      strings={strings}
                      onRunAction={performAction}
                      onRetry={() => void ask(lastQuestionRef.current)}
                      animate={turn.id === revealTurnId}
                      onReveal={pinToBottom}
                    />
                  ))}

                  {busy && (
                    <div className="flex items-center gap-2 text-sm text-ink-muted">
                      <span className="flex gap-1" aria-hidden>
                        <span className="assistant-dot h-1.5 w-1.5 rounded-full bg-ink-muted" />
                        <span className="assistant-dot h-1.5 w-1.5 rounded-full bg-ink-muted" />
                        <span className="assistant-dot h-1.5 w-1.5 rounded-full bg-ink-muted" />
                      </span>
                      {strings.loading}
                    </div>
                  )}

                  {!busy && latestSuggestions.length > 0 && (
                    <div className="pt-1">
                      <AssistantSuggestions
                        heading={strings.suggestions}
                        questions={latestSuggestions}
                        onPick={(question) => void ask(question)}
                        disabled={busy}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/*
              Announces new answers, errors, and action confirmations to screen
              readers. Kept outside the scroll area so re-rendering the list
              never re-announces an older message.
            */}
            <p className="sr-only" role="status" aria-live="polite">
              {liveMessage}
            </p>

            <div
              className="border-t border-line bg-surface px-4 pb-3 pt-3 md:rounded-b-2xl"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
              <AssistantComposer
                value={draft}
                onChange={setDraft}
                onSend={() => void ask(draft)}
                onStop={stop}
                busy={busy}
                disabled={!configured}
                strings={strings}
              />
              <p className="mt-2 text-[11px] leading-snug text-ink-muted">
                {strings.disclaimer}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

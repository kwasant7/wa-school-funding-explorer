/**
 * Did the visitor ask the assistant to *do* something, or just to explain
 * something?
 *
 * Kept free of React and Next imports so it can be unit-tested directly - this
 * is the check that decides whether the page changes without being asked, so
 * it is worth being able to assert on it.
 *
 * The model is separately instructed to emit actions only on an explicit
 * request. This is the second, independent gate: a model that misreads "what
 * would happen if I set the multiplier to 2?" as a command would otherwise
 * silently rewrite the visitor's simulator. A false negative here costs one
 * click; a false positive changes the page uninvited. So the bar is a visible
 * imperative, and everything else is offered as a button.
 */
import type { AssistantAction } from '@/lib/assistant/types';

/**
 * Imperative cues in every language the site supports, plus the English verbs
 * that appear even in otherwise-translated questions.
 */
export const IMPERATIVE_CUES = [
  // English
  'take me', 'go to', 'show me', 'open', 'switch', 'change', 'set ', 'select',
  'pick ', 'choose', 'navigate', 'jump to', 'scroll', 'compare', 'reset',
  'bring up', 'load', 'find me',
  // Spanish
  'llévame', 'llevame', 'ir a', 'muéstrame', 'muestrame', 'abre', 'abrir',
  'cambia', 'cambiar', 'selecciona', 'elige', 'establece', 'pon ', 'reinicia',
  'compara',
  // Chinese
  '带我', '前往', '给我看', '显示', '打开', '切换', '设置', '选择', '重置', '比较', '跳到',
  // Vietnamese
  'đưa tôi', 'đi tới', 'đi đến', 'cho tôi xem', 'mở', 'chuyển', 'đặt', 'chọn',
  'đặt lại', 'so sánh',
  // Russian
  'открой', 'открыть', 'перейти', 'покажи', 'переключи', 'установи', 'выбери',
  'сбрось', 'сравни',
  // Tagalog
  'dalhin mo', 'pumunta', 'ipakita', 'buksan', 'palitan', 'itakda', 'piliin',
  'i-reset', 'ihambing',
  // Korean
  '보여줘', '보여 줘', '열어', '이동', '바꿔', '변경', '설정', '선택', '초기화', '비교',
];

/**
 * Words that open a question. A message starting with one of these is asking
 * about something, not commanding it - "what changed in 2023-24?" must not
 * switch the year, and "how does this compare with the state average?" (one of
 * this site's own starter questions) must not swap the district.
 *
 * Politely-phrased commands like "can you switch to 2023-24?" are caught by
 * this too, and get offered as a button instead of running. That is the right
 * side to err on: the visitor clicks once, rather than the page moving under
 * someone who was only asking.
 */
const QUESTION_OPENERS = [
  // English
  'what', 'why', 'how', 'when', 'where', 'who', 'which', 'is', 'are', 'does',
  'do', 'did', 'can', 'could', 'would', 'should', 'will', 'tell', 'explain',
  // Spanish
  'qué', 'que', 'por qué', 'cómo', 'como', 'cuándo', 'dónde', 'quién', 'cuál',
  // Vietnamese / Tagalog
  'tại sao', 'làm sao', 'cái gì', 'ano', 'bakit', 'paano', 'saan', 'kailan',
  // Russian
  'что', 'почему', 'как', 'когда', 'где', 'кто', 'какой',
];

function startsWithQuestion(text: string): boolean {
  const opening = text.trimStart();
  return QUESTION_OPENERS.some(
    (word) =>
      opening.startsWith(`${word} `) ||
      opening.startsWith(`${word}'`) ||
      opening === word
  );
}

/**
 * Match a cue as a whole word where the script has word boundaries, and as a
 * substring where it does not.
 *
 * `\b` is defined over ASCII word characters, so it silently fails on the
 * accented Spanish and the Cyrillic, Chinese, Korean and Vietnamese cues -
 * which is why those fall back to substring matching. Without the word-boundary
 * pass, "change" matches inside "changed" and every past-tense question about
 * a change looks like a command.
 */
function matchesCue(text: string, cue: string): boolean {
  if (!/^[a-z' ]+$/.test(cue)) return text.includes(cue);
  const escaped = cue.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`).test(text);
}

/** Does the visitor's message read as a command rather than a question? */
export function requestsAction(message: string): boolean {
  const text = message.toLowerCase();
  if (startsWithQuestion(text)) return false;
  return IMPERATIVE_CUES.some((cue) => matchesCue(text, cue));
}

/** Scrolling and highlighting move the viewport, not the data. */
export function isViewportOnly(action: AssistantAction): boolean {
  return action.type === 'scroll_to_section' || action.type === 'highlight_section';
}

export function shouldAutoRun(action: AssistantAction, message: string): boolean {
  if (isViewportOnly(action)) return true;
  return requestsAction(message);
}

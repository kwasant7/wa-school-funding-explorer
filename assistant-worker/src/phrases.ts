/**
 * Disambiguation for the handful of phrases this site's own vocabulary makes
 * genuinely ambiguous.
 *
 * This exists because prompt wording was not enough. "What was the
 * funding/FTE" asks for dollars - the map's tooltips print the figure as
 * "$23,533/FTE", so the notation is the site's, not the visitor's invention -
 * but the words nearest the question are "funding" and "FTE", and the model
 * returned the student count instead. Labelling the figure with the notation
 * and stating the rule in the system prompt got it right most of the time.
 * Most of the time is not a fix: the same question answered two different ways
 * on two afternoons is worse than one that is reliably terse.
 *
 * So the disambiguation is attached to the request rather than left to the
 * model to infer. It is a pure string function, which makes it testable and
 * means it costs nothing at runtime - no extra call, no extra tokens beyond
 * the sentence itself, and it only fires on a question that contains the
 * ambiguity.
 */

type Phrase = { test: RegExp; note: string };

const PHRASES: Phrase[] = [
  {
    /*
      "funding/FTE", "$/FTE", "per FTE", "funding per FTE". Deliberately not
      matching a bare "FTE" - "how many FTE does Seattle have" is a question
      about the count, and answering it with dollars would be the same mistake
      in the other direction.
    */
    test: /(funding|revenue|money|\$|dollars?)\s*(\/|per)\s*(funding\s*)?fte|(\$|dollars?)\s*\/\s*fte|per[-\s]?fte\b/i,
    note:
      'The visitor wrote a phrase like "funding/FTE" or "per FTE". The slash means "per": ' +
      'they are asking for the dollar amount per student - the figure this site labels ' +
      '"funding per student" and prints on its maps as "$21,380/FTE". Answer with that ' +
      'dollar amount. Do not answer with the funding FTE student count.',
  },
  {
    // The mirror image, so the rule above cannot push an honest count question
    // towards dollars.
    test: /how many (students|fte)|(student|fte) count|number of (students|fte)/i,
    note:
      'The visitor is asking how many students, so answer with a count - the funding FTE ' +
      'or the October headcount, whichever they named - and not with a dollar amount.',
  },
];

/**
 * Notes to attach to this question, or null if it contains nothing ambiguous.
 * Returned as one block so the caller does not have to know how many there
 * are.
 */
export function phraseNotes(message: string): string | null {
  const notes = PHRASES.filter((phrase) => phrase.test.test(message)).map(
    (phrase) => `- ${phrase.note}`
  );
  if (notes.length === 0) return null;
  return `## What the visitor's wording means here\n${notes.join('\n')}`;
}

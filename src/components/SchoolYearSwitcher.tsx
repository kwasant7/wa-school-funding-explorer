'use client';

/**
 * The school-year control, in the site header beside the language control.
 *
 * The year used to live inside each page, which put two global-looking
 * switches in two different places: language in the top bar, year halfway down
 * the page. They do the same kind of thing - they change what every figure on
 * screen refers to - so they belong together.
 *
 * The year itself still lives in the page that owns it. This component reads
 * the published year and calls the setter that page registered, through the
 * same small store the assistant uses. That keeps the year exactly one piece
 * of state rather than a header copy the pages have to stay in sync with, and
 * it means the control is absent on pages that have no year to change: the
 * Simulator, Take Action and Sources never publish one, so nothing renders.
 */
import { YEARS } from '@/lib/years';
import { assistantHandlers, useAssistantSnapshot } from '@/lib/assistant/store';

export default function SchoolYearSwitcher() {
  const { schoolYear } = useAssistantSnapshot();

  /*
    Null on the server and on pages without a year control. Rendering nothing
    is right in both cases - a disabled year dropdown on the Sources page would
    just be a question the visitor cannot act on.
  */
  if (!schoolYear) return null;

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="site-school-year" className="text-xs font-medium text-ink-secondary">
        School year
      </label>
      <select
        id="site-school-year"
        value={schoolYear}
        onChange={(event) => assistantHandlers().setSchoolYear?.(event.target.value)}
        className="rounded border border-line bg-surface px-2 py-1.5 text-sm text-ink"
        data-no-translate
      >
        {YEARS.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  );
}

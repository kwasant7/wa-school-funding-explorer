/**
 * The one district code shared across pages via `localStorage`, so picking a
 * district on one page has it waiting on the next. Four places wrote this
 * under a bare string literal before this module existed - a typo in any one
 * of them would have silently broken the hand-off. `localStorage` also throws
 * in Safari private browsing, which none of the call sites guarded against.
 */
export const SELECTED_DISTRICT_KEY = 'wa-selected-district';

export function readSelectedDistrict(): string | null {
  try {
    return window.localStorage.getItem(SELECTED_DISTRICT_KEY);
  } catch {
    return null;
  }
}

export function writeSelectedDistrict(code: string | null): void {
  try {
    if (code) {
      window.localStorage.setItem(SELECTED_DISTRICT_KEY, code);
    } else {
      window.localStorage.removeItem(SELECTED_DISTRICT_KEY);
    }
  } catch {
    // Storage is unavailable (private browsing, quota, disabled). The
    // selection simply won't carry over to the next page - not worth
    // surfacing to the visitor.
  }
}

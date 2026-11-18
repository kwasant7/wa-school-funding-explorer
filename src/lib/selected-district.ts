/**
 * The one district code shared across pages via `localStorage`, so picking a
 * district on one page has it waiting on the next. Four places wrote this
 * under a bare string literal before this module existed - a typo in any one
 * of them would have silently broken the hand-off. `localStorage` also throws
 * in Safari private browsing, which none of the call sites guarded against.
 */
export const SELECTED_DISTRICT_KEY = 'wa-selected-district';

/**
 * The district every page opens on for a visitor who hasn't picked one yet.
 * Seattle is the state's largest district and the one most visitors will
 * recognise, and its figures exercise every panel (a deficit, a thin reserve,
 * a levy). One constant so all the tabs open on the same place.
 */
export const DEFAULT_DISTRICT_CODE = '17001';

/**
 * The visitor's saved district if it still exists in the data, otherwise the
 * default. `exists` is passed in because pages check against different data
 * (the latest year, the simulator's own table).
 */
export function initialDistrictCode(
  exists: (code: string) => boolean
): string | null {
  const saved = readSelectedDistrict();
  if (saved && exists(saved)) return saved;
  return exists(DEFAULT_DISTRICT_CODE) ? DEFAULT_DISTRICT_CODE : null;
}

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

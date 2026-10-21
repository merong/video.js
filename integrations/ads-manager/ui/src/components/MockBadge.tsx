export const MOCK_BADGE_TEXT = '목업 · 아직 동작하지 않아요';

/** Marks a mock screen. Put one beside the page title; the wording is fixed. */
export function MockBadge() {
  return <span className="sa-mock">{MOCK_BADGE_TEXT}</span>;
}

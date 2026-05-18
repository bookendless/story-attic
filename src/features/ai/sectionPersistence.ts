/**
 * アコーディオン式セクションの開閉状態を localStorage に永続化するヘルパー。
 * 命名規約: `story-attic-ai-section-{phase}-{name}`
 */

const PREFIX = 'story-attic-ai-section-';

/** セクションの開閉状態を読み込む。未保存なら fallback を返す。 */
export function loadSectionOpen(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(PREFIX + key);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch { /* 無視 */ }
  return fallback;
}

/** セクションの開閉状態を保存する。 */
export function saveSectionOpen(key: string, open: boolean): void {
  try {
    localStorage.setItem(PREFIX + key, open ? '1' : '0');
  } catch { /* 無視 */ }
}

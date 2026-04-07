/**
 * 執筆アクティビティのトラッカー（モジュールレベルシングルトン）
 * エディタでテキストが変更されたときに notifyActivity() を呼び出し、
 * CharacterWidget が無操作時間を計測してゴーストを表示する。
 */

type Listener = () => void;
const listeners = new Set<Listener>();

/** アクティビティ（タイピングなど）を通知する */
export function notifyActivity(): void {
  for (const fn of listeners) fn();
}

/**
 * アクティビティ監視リスナーを登録する。
 * @returns アンサブスクライブ関数
 */
export function onActivity(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

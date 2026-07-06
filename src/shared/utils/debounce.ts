/**
 * debounce ユーティリティ。
 * 返り値の関数は最後の呼び出しから ms 経過後に一度だけ実行される。
 * cancel() で未実行の呼び出しを破棄できる（アンマウント時のクリーンアップ用）。
 */
export function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

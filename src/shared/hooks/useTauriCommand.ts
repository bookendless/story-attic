import { invoke } from '@tauri-apps/api/core';

/**
 * Tauriコマンドを呼び出すユーティリティ
 * Rustのスネークケースキーをキャメルケースに変換して返す
 */
export async function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
}

/** オブジェクトのキーをスネークケース → キャメルケースに変換（浅いコピー） */
export function toCamelCase<T>(obj: unknown): T {
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase) as unknown as T;
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
        toCamelCase(v),
      ]),
    ) as T;
  }
  return obj as T;
}

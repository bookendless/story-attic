import { create } from 'zustand';

/** トーストの種別 */
export type ToastType = 'error' | 'success' | 'info';

/** トーストに付与できるアクションボタン（例: 保存の再試行） */
export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  action?: ToastAction;
}

interface ToastState {
  toasts: ToastItem[];
  /** トーストを表示する。error は手動クローズまで残留、他は自動消滅 */
  showToast: (type: ToastType, message: string, action?: ToastAction) => void;
  dismissToast: (id: number) => void;
}

let nextId = 1;

/** error 以外の自動消滅までの時間 */
const AUTO_DISMISS_MS = 4000;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  showToast: (type, message, action) => {
    // 同一メッセージの重複表示を防ぐ（オートセーブ失敗の連続発火対策）
    if (get().toasts.some((t) => t.type === type && t.message === message)) return;

    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, type, message, action }] }));

    if (type !== 'error') {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, AUTO_DISMISS_MS);
    }
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** コンポーネント外（zustand ストアやユーティリティ）からトーストを表示するヘルパー */
export function showToast(type: ToastType, message: string, action?: ToastAction) {
  useToastStore.getState().showToast(type, message, action);
}

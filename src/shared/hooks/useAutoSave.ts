import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/shared/stores/editorStore';
import { useUIStore } from '@/shared/stores/uiStore';

/**
 * 自動保存フック。
 * 設定で有効な場合、指定間隔で isDirty なエピソードを自動保存する。
 */
export function useAutoSave() {
  const autoSave = useEditorStore((s) => s.autoSave);
  const settings = useUIStore((s) => s.settings);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // 自動保存が無効の場合はタイマーをクリア
    if (!settings.auto_save) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const intervalMs = settings.auto_save_interval_sec * 1000;

    // 既存タイマーをクリアして再設定
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      // isDirty の最新値を直接ストアから取得
      const { isDirty: currentDirty, isSaving } = useEditorStore.getState();
      if (currentDirty && !isSaving) {
        void useEditorStore.getState().autoSave();
      }
    }, intervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [settings.auto_save, settings.auto_save_interval_sec, autoSave]);
}

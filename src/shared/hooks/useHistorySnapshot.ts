import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/shared/stores/editorStore';

const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000; // 5分

/**
 * 5分間隔で自動スナップショットを作成するフック。
 * 前回スナップショット時から本文が変化していない場合はスキップする。
 */
export function useHistorySnapshot() {
  const takeSnapshot = useEditorStore((s) => s.takeSnapshot);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 前回スナップショット時の body を保持（重複防止）
  const lastBodyRef = useRef<string | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      const { currentEpisode } = useEditorStore.getState();
      if (!currentEpisode) return;

      // 本文が前回と同じなら作成しない
      if (lastBodyRef.current === currentEpisode.body) return;

      void takeSnapshot().then(() => {
        lastBodyRef.current = currentEpisode.body;
      });
    }, SNAPSHOT_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [takeSnapshot]);
}

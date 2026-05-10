import { useEffect, useRef } from 'react';
import { useUIStore } from '@/shared/stores/uiStore';

const IDLE_THRESHOLD_SEC = 180;

export function usePassiveSessionTracker(
  projectId: string | null | undefined,
  charCount: number,
) {
  const timerRunning = useUIStore((s) => s.timerRunning);
  const incrementPassiveSession = useUIStore((s) => s.incrementPassiveSession);
  const flushPassiveSession = useUIStore((s) => s.flushPassiveSession);
  const resetTodayIfNeeded = useUIStore((s) => s.resetTodayIfNeeded);

  const lastActivityAtRef = useRef<number | null>(null);
  const charCountRef = useRef(charCount);
  const projectIdRef = useRef(projectId);
  const timerRunningRef = useRef(timerRunning);

  useEffect(() => { charCountRef.current = charCount; }, [charCount]);
  useEffect(() => { projectIdRef.current = projectId; }, [projectId]);
  useEffect(() => { timerRunningRef.current = timerRunning; }, [timerRunning]);

  // キーストロークでアクティビティを検知
  useEffect(() => {
    const handleActivity = () => {
      if (!timerRunningRef.current) {
        lastActivityAtRef.current = Date.now();
      }
    };
    document.addEventListener('keydown', handleActivity);
    return () => document.removeEventListener('keydown', handleActivity);
  }, []);

  // タイマー開始時：未フラッシュ分を強制保存してパッシブ計時を停止
  useEffect(() => {
    if (timerRunning) {
      const pid = projectIdRef.current;
      if (pid) {
        flushPassiveSession(pid, charCountRef.current);
      }
      lastActivityAtRef.current = null;
    }
  }, [timerRunning, flushPassiveSession]);

  // 1秒ごとのティック
  useEffect(() => {
    const interval = setInterval(() => {
      resetTodayIfNeeded();

      if (timerRunningRef.current) return;
      if (lastActivityAtRef.current === null) return;

      const idleSec = (Date.now() - lastActivityAtRef.current) / 1000;

      if (idleSec <= IDLE_THRESHOLD_SEC) {
        incrementPassiveSession(1);
      } else {
        const pid = projectIdRef.current;
        if (pid) {
          flushPassiveSession(pid, charCountRef.current);
        }
        lastActivityAtRef.current = null;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [incrementPassiveSession, flushPassiveSession, resetTodayIfNeeded]);
}

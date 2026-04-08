/**
 * 執筆タイマー — カウントダウン・チャレンジモード
 */

import { useState, useRef, useCallback, useEffect } from 'react';

interface WritingTimerProps {
  onSessionEnd?: (durationSec: number) => void;
}

export function WritingTimer({ onSessionEnd }: WritingTimerProps) {
  const [minutes, setMinutes] = useState(25);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const start = useCallback(() => {
    const totalSec = minutes * 60;
    setRemaining(totalSec);
    setRunning(true);
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const left = Math.max(0, totalSec - elapsed);
      setRemaining(left);
      if (left <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        setRunning(false);
        onSessionEnd?.(totalSec);
      }
    }, 1000);
  }, [minutes, onSessionEnd]);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRunning(false);
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    if (elapsed > 10) onSessionEnd?.(elapsed);
    setRemaining(0);
  }, [onSessionEnd]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-medium" style={{ color: 'var(--text)' }}>執筆タイマー</h3>

      {!running ? (
        <div className="flex items-center gap-2">
          <input
            type="number"
            className="text-xs bg-transparent outline-none"
            style={{ color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px', width: '60px' }}
            value={minutes}
            onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))}
            min={1}
            max={180}
          />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>分</span>
          <button
            className="text-xs px-3 py-1 rounded"
            style={{ background: 'var(--accent)', color: 'var(--bg-deep)', border: 'none', cursor: 'pointer' }}
            onClick={start}
          >
            開始
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span
            className="text-lg font-mono"
            style={{ color: remaining <= 60 ? 'var(--danger)' : 'var(--accent)', fontFamily: 'var(--font-heading)' }}
          >
            {formatTime(remaining)}
          </span>
          <button
            className="text-xs px-3 py-1 rounded"
            style={{ background: 'var(--danger)', color: '#fff', border: 'none', cursor: 'pointer' }}
            onClick={stop}
          >
            停止
          </button>
        </div>
      )}

      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
        タイマー終了時に執筆セッションが記録されます
      </div>
    </div>
  );
}

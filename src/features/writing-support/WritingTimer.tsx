/**
 * 執筆タイマー — uiStoreのタイマー状態と同期
 * StatusBarのタイマーと共通の状態を使用
 */

import { useState } from 'react';
import { useUIStore } from '@/shared/stores/uiStore';

/** 秒数を MM:SS にフォーマット */
function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function WritingTimer() {
  const { timerRunning, timerRemaining, startTimer, stopTimer } = useUIStore();
  const [minutes, setMinutes] = useState(25);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-medium" style={{ color: 'var(--text)' }}>執筆タイマー</h3>

      {!timerRunning ? (
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
            onClick={() => startTimer(minutes)}
          >
            開始
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span
            className="text-lg font-mono"
            style={{ color: timerRemaining <= 60 ? 'var(--danger)' : 'var(--accent)', fontFamily: 'var(--font-heading)' }}
          >
            {formatTime(timerRemaining)}
          </span>
          <button
            className="text-xs px-3 py-1 rounded"
            style={{ background: 'var(--danger)', color: '#fff', border: 'none', cursor: 'pointer' }}
            onClick={stopTimer}
          >
            停止
          </button>
        </div>
      )}

      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
        タイマーはステータスバーからも操作できます
      </div>
    </div>
  );
}

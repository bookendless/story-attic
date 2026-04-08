/**
 * 目標設定 — 目標文字数・締切・進捗バー
 */

import { useState } from 'react';

interface GoalSettingProps {
  currentCharCount: number;
}

export function GoalSetting({ currentCharCount }: GoalSettingProps) {
  const [goalChars, setGoalChars] = useState(() => {
    try { return Number(localStorage.getItem('story-attic-goal-chars')) || 0; } catch { return 0; }
  });
  const [deadline, setDeadline] = useState(() => {
    try { return localStorage.getItem('story-attic-goal-deadline') || ''; } catch { return ''; }
  });

  const saveGoal = (chars: number) => {
    setGoalChars(chars);
    try { localStorage.setItem('story-attic-goal-chars', String(chars)); } catch { /* 無視 */ }
  };

  const saveDeadline = (d: string) => {
    setDeadline(d);
    try { localStorage.setItem('story-attic-goal-deadline', d); } catch { /* 無視 */ }
  };

  const progress = goalChars > 0 ? Math.min(100, Math.round((currentCharCount / goalChars) * 100)) : 0;

  // 残り日数
  const daysLeft = deadline
    ? Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-medium" style={{ color: 'var(--text)' }}>目標設定</h3>

      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: 'var(--text-muted)', width: '60px' }}>目標文字数</span>
        <input
          type="number"
          className="flex-1 text-xs bg-transparent outline-none"
          style={{ color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px' }}
          value={goalChars || ''}
          onChange={(e) => saveGoal(Number(e.target.value) || 0)}
          placeholder="例: 100000"
          min={0}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: 'var(--text-muted)', width: '60px' }}>締切</span>
        <input
          type="date"
          className="flex-1 text-xs bg-transparent outline-none"
          style={{ color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px' }}
          value={deadline}
          onChange={(e) => saveDeadline(e.target.value)}
        />
      </div>

      {goalChars > 0 && (
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span style={{ color: 'var(--text-mid)' }}>
              {currentCharCount.toLocaleString()} / {goalChars.toLocaleString()} 文字
            </span>
            <span style={{ color: 'var(--accent)' }}>{progress}%</span>
          </div>
          <div style={{ height: '6px', background: 'var(--bg)', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: progress >= 100 ? 'var(--success)' : 'var(--accent)',
                borderRadius: '3px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          {daysLeft !== null && (
            <div className="text-xs mt-1" style={{ color: daysLeft <= 3 ? 'var(--danger)' : 'var(--text-muted)' }}>
              {daysLeft > 0 ? `締切まであと ${daysLeft} 日` : '締切を過ぎています'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 目標設定 — 1日の目標文字数・締切・進捗バー
 * uiStoreのdailyGoalと同期し、StatusBarの進捗バーに反映
 * 進捗は「今日書いた字数」（エピソード横断の当日差分）で計測する
 */

import { useState } from 'react';
import { useUIStore } from '@/shared/stores/uiStore';

export function GoalSetting() {
  const { dailyGoal, setDailyGoal } = useUIStore();
  const todayWrittenChars = useUIStore((s) => s.todayWrittenChars);
  const [goalChars, setGoalChars] = useState(dailyGoal ?? 0);
  const [deadline, setDeadline] = useState(() => {
    try { return localStorage.getItem('story-attic-goal-deadline') || ''; } catch { return ''; }
  });

  const saveGoal = (chars: number) => {
    setGoalChars(chars);
    setDailyGoal(chars || null);
  };

  const saveDeadline = (d: string) => {
    setDeadline(d);
    try { localStorage.setItem('story-attic-goal-deadline', d); } catch { /* 無視 */ }
  };

  const progress = goalChars > 0 ? Math.min(100, Math.round((todayWrittenChars / goalChars) * 100)) : 0;

  // 残り日数
  const daysLeft = deadline
    ? Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-medium" style={{ color: 'var(--text)' }}>目標設定</h3>

      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: 'var(--text-muted)', width: '60px' }}>1日の目標</span>
        <input
          type="number"
          className="flex-1 text-xs bg-transparent outline-none"
          style={{ color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px' }}
          value={goalChars || ''}
          onChange={(e) => saveGoal(Number(e.target.value) || 0)}
          placeholder="例: 2000"
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
              今日 +{todayWrittenChars.toLocaleString()} / {goalChars.toLocaleString()} 文字
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

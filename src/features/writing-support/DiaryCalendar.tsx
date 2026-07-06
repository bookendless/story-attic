/**
 * 執筆日記カレンダー — SVGベースのヒートマップ（GitHub風）
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import type { DiaryEntry } from '@/shared/types';

interface DiaryCalendarProps {
  projectId: string | null;
}

const CELL_SIZE = 10;
const CELL_GAP = 2;
const WEEKS = 26;

function getDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function DiaryCalendar({ projectId }: DiaryCalendarProps) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);

  const loadEntries = useCallback(async () => {
    if (!projectId) { setEntries([]); return; }
    try {
      const result = await invoke<unknown[]>('get_diary_entries', { projectId });
      setEntries(toCamelCase<DiaryEntry[]>(result));
    } catch { /* 無視 */ }
  }, [projectId]);

  useEffect(() => { void loadEntries(); }, [loadEntries]);

  // 日付→文字数マップ
  const charMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      map.set(e.date, (map.get(e.date) || 0) + e.charCount);
    }
    return map;
  }, [entries]);

  // 最大文字数（ヒートマップのスケーリング用）
  const maxChars = useMemo(() => {
    let max = 0;
    for (const v of charMap.values()) { if (v > max) max = v; }
    return max || 1;
  }, [charMap]);

  // カレンダーの日付グリッド生成（過去26週分）
  const grid = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (WEEKS * 7 - 1) - dayOfWeek);

    const weeks: { date: Date; key: string; chars: number }[][] = [];
    const current = new Date(startDate);
    for (let w = 0; w < WEEKS; w++) {
      const week: { date: Date; key: string; chars: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const key = getDateKey(current);
        week.push({ date: new Date(current), key, chars: charMap.get(key) || 0 });
        current.setDate(current.getDate() + 1);
      }
      weeks.push(week);
    }
    return weeks;
  }, [charMap]);

  // 連続執筆日数
  const streak = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let count = 0;
    const d = new Date(today);
    while (true) {
      const key = getDateKey(d);
      if (charMap.has(key) && charMap.get(key)! > 0) {
        count++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return count;
  }, [charMap]);

  // 合計文字数
  const totalChars = useMemo(() => {
    let total = 0;
    for (const v of charMap.values()) total += v;
    return total;
  }, [charMap]);

  const getColor = (chars: number): string => {
    if (chars === 0) return 'var(--bg)';
    const ratio = chars / maxChars;
    if (ratio < 0.25) return 'rgba(196,149,106,0.2)';
    if (ratio < 0.5) return 'rgba(196,149,106,0.4)';
    if (ratio < 0.75) return 'rgba(196,149,106,0.6)';
    return 'rgba(196,149,106,0.85)';
  };

  const svgWidth = WEEKS * (CELL_SIZE + CELL_GAP);
  const svgHeight = 7 * (CELL_SIZE + CELL_GAP);

  if (!projectId) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium" style={{ color: 'var(--text)' }}>執筆日記</h3>

      <div className="flex gap-3 text-xs" style={{ color: 'var(--text-mid)' }}>
        <span>連続 <strong style={{ color: 'var(--accent)' }}>{streak}</strong> 日</span>
        <span>合計 <strong style={{ color: 'var(--accent)' }}>{totalChars.toLocaleString()}</strong> 文字</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <svg width={svgWidth} height={svgHeight}>
          {grid.map((week, wi) =>
            week.map((day, di) => (
              <rect
                key={day.key}
                x={wi * (CELL_SIZE + CELL_GAP)}
                y={di * (CELL_SIZE + CELL_GAP)}
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx={2}
                fill={getColor(day.chars)}
                stroke="var(--border)"
                strokeWidth={0.5}
              >
                <title>{`${day.key}: ${day.chars.toLocaleString()} 文字`}</title>
              </rect>
            ))
          )}
        </svg>
      </div>

      {entries.length === 0 && (
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          執筆セッション記録がありません。タイマーを使って執筆すると記録されます。
        </div>
      )}
    </div>
  );
}

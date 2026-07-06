/**
 * セッション終了サマリーカード
 * タイマーの終了/停止時に表示し、セッションの執筆量・時間・連続執筆日数を称える。
 * 「明日の自分へのメモ」を残すと、次回起動時の再開カードに表示される。
 */

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import { useUIStore } from '@/shared/stores/uiStore';
import { useAppStore } from '@/shared/stores/appStore';
import { saveResumeNote } from '@/shared/utils/resumeSession';
import type { DiaryEntry } from '@/shared/types';

/** 秒数を「X分」「X時間Y分」にフォーマット */
function formatDuration(sec: number): string {
  const min = Math.max(1, Math.round(sec / 60));
  if (min < 60) return `${min}分`;
  return `${Math.floor(min / 60)}時間${min % 60 > 0 ? `${min % 60}分` : ''}`;
}

/** 執筆量に応じたねぎらいメッセージ */
function praiseFor(chars: number, goalReached: boolean): string {
  if (goalReached) return '今日の目標を達成しました。素晴らしいペースです';
  if (chars >= 1000) return 'たっぷり書けました。物語が確かに進んでいます';
  if (chars >= 300) return '着実な一歩。この積み重ねが作品になります';
  if (chars > 0) return '少しでも前へ。書いた分だけ物語は育ちます';
  return '机に向かった時間そのものが、次の一文への助走です';
}

export function SessionSummaryCard() {
  const sessionSummary = useUIStore((s) => s.sessionSummary);
  const clearSessionSummary = useUIStore((s) => s.clearSessionSummary);
  const dailyGoal = useUIStore((s) => s.dailyGoal);
  const todayWrittenChars = useUIStore((s) => s.todayWrittenChars);
  const projectId = useAppStore((s) => s.currentProjectId);
  const [streak, setStreak] = useState<number | null>(null);
  const [note, setNote] = useState('');

  // 表示のたびにメモをリセットし、連続執筆日数を取得
  useEffect(() => {
    if (!sessionSummary) return;
    setNote('');
    if (!projectId) { setStreak(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const raw = await invoke<unknown[]>('get_diary_entries', { projectId });
        const entries = toCamelCase<DiaryEntry[]>(raw);
        const days = new Set(
          entries.filter((e) => e.sessionSec > 0 || e.charCount > 0).map((e) => e.date),
        );
        // 今日を1日目として昨日以前を遡って数える
        let count = 1;
        const d = new Date();
        for (;;) {
          d.setDate(d.getDate() - 1);
          if (days.has(d.toISOString().slice(0, 10))) count++;
          else break;
        }
        if (!cancelled) setStreak(count);
      } catch {
        if (!cancelled) setStreak(null);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionSummary, projectId]);

  if (!sessionSummary) return null;

  const goalReached = !!dailyGoal && dailyGoal > 0 && todayWrittenChars >= dailyGoal;

  const handleClose = () => {
    if (projectId && note.trim()) saveResumeNote(projectId, note.trim());
    clearSessionSummary();
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '48px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 140,
        width: '340px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-light)',
        borderRadius: '12px',
        padding: '16px 18px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
      }}
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', color: 'var(--accent)' }}>
          おつかれさまでした
        </span>
        <button
          onClick={handleClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', lineHeight: 1 }}
        >
          ✕
        </button>
      </div>

      {/* 統計 */}
      <div className="flex items-center gap-4 mb-2">
        <div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: goalReached ? 'var(--success)' : 'var(--text)' }}>
            +{sessionSummary.chars.toLocaleString()}字
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>このセッション</div>
        </div>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)' }}>
            {formatDuration(sessionSummary.sec)}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>執筆時間</div>
        </div>
        {streak !== null && streak >= 2 && (
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--warning)' }}>
              {streak}日
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>連続執筆</div>
          </div>
        )}
      </div>

      {/* ねぎらい */}
      <p style={{ fontSize: '11px', color: 'var(--text-mid)', lineHeight: 1.6, marginBottom: '12px' }}>
        {praiseFor(sessionSummary.chars, goalReached)}
      </p>

      {/* 明日の自分へのメモ */}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="明日の自分へひとこと（例: 決闘シーンの続きから）"
        rows={2}
        className="w-full text-xs bg-transparent outline-none resize-none"
        style={{
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          padding: '6px 8px',
          marginBottom: '10px',
        }}
      />

      <button
        className="btn btn-primary"
        style={{ width: '100%', fontSize: '12px', justifyContent: 'center' }}
        onClick={handleClose}
      >
        {note.trim() ? 'メモを残して閉じる' : '閉じる'}
      </button>
    </div>
  );
}

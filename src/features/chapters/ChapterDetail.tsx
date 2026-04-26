/**
 * 章詳細・編集ビュー — タイトル + 概要を編集する。
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Chapter } from '@/shared/types';

interface Props {
  chapter: Chapter;
  episodeCount: number;
  onBack: () => void;
  onUpdate: () => void | Promise<void>;
}

export function ChapterDetail({ chapter, episodeCount, onBack, onUpdate }: Props) {
  const [title, setTitle] = useState(chapter.title);
  const [summary, setSummary] = useState(chapter.summary ?? '');
  const [setting, setSetting] = useState(chapter.setting ?? '');
  const [mood, setMood] = useState(chapter.mood ?? '');
  const [importantEvents, setImportantEvents] = useState(chapter.importantEvents ?? '');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setTitle(chapter.title);
    setSummary(chapter.summary ?? '');
    setSetting(chapter.setting ?? '');
    setMood(chapter.mood ?? '');
    setImportantEvents(chapter.importantEvents ?? '');
    setDirty(false);
  }, [chapter.id, chapter.title, chapter.summary, chapter.setting, chapter.mood, chapter.importantEvents]);

  const handleSave = useCallback(async () => {
    try {
      await invoke('update_chapter', { id: chapter.id, title, summary, setting, mood, importantEvents });
      setDirty(false);
      await onUpdate();
    } catch { /* 無視 */ }
  }, [chapter.id, title, summary, setting, mood, importantEvents, onUpdate]);

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <button
          onClick={onBack}
          className="text-xs"
          style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}
        >
          ← 戻る
        </button>
        <div className="flex-1" />
        <button
          onClick={handleSave}
          disabled={!dirty}
          className="text-xs px-2 py-1 rounded"
          style={{
            background: dirty ? 'var(--accent)' : 'transparent',
            color: dirty ? '#fff' : 'var(--text-muted)',
            border: '1px solid var(--border)',
            cursor: dirty ? 'pointer' : 'default',
          }}
        >
          保存
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        <Field label="タイトル">
          <input
            className="w-full text-sm px-2 py-1 rounded"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            value={title}
            onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
          />
        </Field>

        <Field label="概要">
          <textarea
            rows={8}
            className="w-full text-sm px-2 py-1 rounded resize-none"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            value={summary}
            onChange={(e) => { setSummary(e.target.value); setDirty(true); }}
            placeholder="この章の内容・狙いを記述"
          />
        </Field>

        <Field label="設定・場所">
          <textarea
            rows={3}
            className="w-full text-sm px-2 py-1 rounded resize-none"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            value={setting}
            onChange={(e) => { setSetting(e.target.value); setDirty(true); }}
            placeholder="登場する場所・舞台設定"
          />
        </Field>

        <Field label="雰囲気・ムード">
          <textarea
            rows={3}
            className="w-full text-sm px-2 py-1 rounded resize-none"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            value={mood}
            onChange={(e) => { setMood(e.target.value); setDirty(true); }}
            placeholder="章のトーン・雰囲気"
          />
        </Field>

        <Field label="重要な出来事">
          <textarea
            rows={5}
            className="w-full text-sm px-2 py-1 rounded resize-none"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            value={importantEvents}
            onChange={(e) => { setImportantEvents(e.target.value); setDirty(true); }}
            placeholder="この章で起きる主要な出来事"
          />
        </Field>

        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          所属エピソード: {episodeCount} 件
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs mb-1 font-medium" style={{ color: 'var(--text-muted)' }}>{label}</div>
      {children}
    </div>
  );
}

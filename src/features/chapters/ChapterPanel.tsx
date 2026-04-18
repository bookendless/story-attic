/**
 * 章立てパネル — 右パネル「章立て」タブ。
 * 章一覧（タイトル + 概要プレビュー + 所属エピソード数）と詳細編集ビューを切り替える。
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/shared/stores/appStore';
import { useEditorStore } from '@/shared/stores/editorStore';
import type { Chapter } from '@/shared/types';
import { ChapterDetail } from './ChapterDetail';

export function ChapterPanel() {
  const projectId = useAppStore((s) => s.currentProjectId);
  const chapterTree = useEditorStore((s) => s.chapterTree);
  const loadChapterTree = useEditorStore((s) => s.loadChapterTree);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chapters = useMemo(() => chapterTree?.chapters ?? [], [chapterTree]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCardClick = useCallback((id: string) => {
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      toggleExpand(id);
      clickTimerRef.current = null;
    }, 220);
  }, [toggleExpand]);

  const handleCardDoubleClick = useCallback((id: string) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    setSelectedId(id);
  }, []);

  useEffect(() => () => {
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
  }, []);

  const reload = useCallback(async () => {
    if (!projectId) return;
    await loadChapterTree(projectId);
  }, [projectId, loadChapterTree]);

  const handleCreate = useCallback(async () => {
    if (!projectId) return;
    try {
      const id = await invoke<string>('create_chapter', {
        projectId,
        title: '新しい章',
      });
      await reload();
      setSelectedId(id);
    } catch { /* 無視 */ }
  }, [projectId, reload]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await invoke('delete_chapter', { id });
      if (selectedId === id) setSelectedId(null);
      await reload();
    } catch { /* 無視 */ }
  }, [selectedId, reload]);

  if (!projectId) return null;

  const selected = chapters.find((c) => c.chapter.id === selectedId);
  if (selected) {
    return (
      <ChapterDetail
        chapter={selected.chapter}
        episodeCount={selected.episodes.length}
        onBack={() => setSelectedId(null)}
        onUpdate={reload}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          章立て（{chapters.length}件）
        </span>
        <button
          onClick={handleCreate}
          className="text-xs px-2 py-1 rounded"
          style={{
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          ＋追加
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {chapters.length === 0 ? (
          <div
            className="flex items-center justify-center h-full text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            章がありません
          </div>
        ) : (
          chapters.map((cwe, idx) => (
            <ChapterCard
              key={cwe.chapter.id}
              chapter={cwe.chapter}
              episodeCount={cwe.episodes.length}
              index={idx + 1}
              expanded={expandedIds.has(cwe.chapter.id)}
              onClick={() => handleCardClick(cwe.chapter.id)}
              onDoubleClick={() => handleCardDoubleClick(cwe.chapter.id)}
              onDelete={() => handleDelete(cwe.chapter.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface ChapterCardProps {
  chapter: Chapter;
  episodeCount: number;
  index: number;
  expanded: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onDelete: () => void;
}

function ChapterCard({
  chapter,
  episodeCount,
  index,
  expanded,
  onClick,
  onDoubleClick,
  onDelete,
}: ChapterCardProps) {
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      >
        <span style={{ fontSize: '10px', opacity: 0.6, width: '10px', flexShrink: 0 }}>
          {expanded ? '▽' : '▷'}
        </span>
        <span
          className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
        >
          第{index}章
        </span>
        <div
          className="text-sm truncate font-medium flex-1 min-w-0"
          style={{ color: 'var(--text-primary)' }}
        >
          {chapter.title || '（タイトルなし）'}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          onDoubleClick={(e) => e.stopPropagation()}
          className="text-xs flex-shrink-0 px-1.5 py-0.5 rounded"
          style={{
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
            background: 'transparent',
            cursor: 'pointer',
          }}
          title="削除"
        >
          ✕
        </button>
      </div>
      {expanded && (
        <div className="px-3 pb-2 pl-8">
          {chapter.summary ? (
            <div
              className="text-xs"
              style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}
            >
              {chapter.summary}
            </div>
          ) : (
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              （概要なし）
            </div>
          )}
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            エピソード {episodeCount} 件
          </div>
        </div>
      )}
    </div>
  );
}

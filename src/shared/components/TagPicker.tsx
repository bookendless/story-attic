/**
 * タグ選択コンポーネント — 全エンティティ（人物・用語・メモ・資料）で共通利用
 *
 * タグチップ一覧 + 入力欄。入力中にプロジェクト内既存タグをオートコンプリート表示。
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Tag } from '@/shared/types';

interface TagPickerProps {
  projectId: string;
  entityType: string;
  entityId: string;
  /** 現在のタグ一覧（親から受け取る） */
  tags: Tag[];
  /** タグ変更時のコールバック（親がリストを再取得する用途） */
  onTagsChange: () => void;
}

export function TagPicker({ projectId, entityType, entityId, tags, onTagsChange }: TagPickerProps) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // プロジェクト内全タグ名のキャッシュ
  const [allTags, setAllTags] = useState<string[]>([]);

  const loadAllTags = useCallback(async () => {
    try {
      const result = await invoke<string[]>('get_all_tags', { projectId });
      setAllTags(result);
    } catch {
      /* 無視 */
    }
  }, [projectId]);

  useEffect(() => {
    loadAllTags();
  }, [loadAllTags]);

  // 入力値でフィルタ
  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const existing = new Set(tags.map((t) => t.tag));
    const filtered = allTags.filter(
      (t) => t.toLowerCase().includes(input.toLowerCase()) && !existing.has(t),
    );
    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
    setSelectedIndex(-1);
  }, [input, allTags, tags]);

  // 外側クリックで候補を閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addTag = useCallback(
    async (tagName: string) => {
      const trimmed = tagName.trim();
      if (!trimmed) return;
      // 既に存在するか確認
      if (tags.some((t) => t.tag === trimmed)) return;

      try {
        await invoke('add_tag', {
          projectId,
          entityType,
          entityId,
          tag: trimmed,
        });
        setInput('');
        setShowSuggestions(false);
        onTagsChange();
        // 新規タグの場合はオートコンプリートキャッシュも更新
        if (!allTags.includes(trimmed)) {
          setAllTags((prev) => [...prev, trimmed].sort());
        }
      } catch {
        /* 無視 */
      }
    },
    [projectId, entityType, entityId, tags, onTagsChange, allTags],
  );

  const removeTag = useCallback(
    async (tagId: string) => {
      try {
        await invoke('remove_tag', { id: tagId });
        onTagsChange();
      } catch {
        /* 無視 */
      }
    },
    [onTagsChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        addTag(suggestions[selectedIndex]);
      } else {
        addTag(input);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* タグチップ一覧 */}
      <div className="flex flex-wrap gap-1 mb-1">
        {tags.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs"
            style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-mid)',
              border: '1px solid var(--border)',
            }}
          >
            {t.tag}
            <button
              className="ml-0.5"
              style={{
                color: 'var(--text-muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '10px',
                lineHeight: 1,
                padding: 0,
              }}
              onClick={() => removeTag(t.id)}
              title="タグを削除"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {/* 入力欄 */}
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
        placeholder="タグを追加..."
        className="w-full text-xs px-2 py-1 rounded"
        style={{
          background: 'var(--bg)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          outline: 'none',
        }}
      />

      {/* オートコンプリート候補 */}
      {showSuggestions && (
        <div
          className="absolute left-0 right-0 mt-0.5 rounded overflow-hidden z-10"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            maxHeight: '120px',
            overflowY: 'auto',
          }}
        >
          {suggestions.map((s, i) => (
            <button
              key={s}
              className="block w-full text-left text-xs px-2 py-1"
              style={{
                background: i === selectedIndex ? 'var(--bg)' : 'transparent',
                color: 'var(--text)',
                border: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={() => setSelectedIndex(i)}
              onClick={() => addTag(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

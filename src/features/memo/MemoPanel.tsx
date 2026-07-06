/**
 * メモパネル — 右パネル内の「メモ」タブ
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import { useAppStore } from '@/shared/stores/appStore';
import type { Memo, Tag } from '@/shared/types';
import { MemoList } from './MemoList';
import { MemoDetail } from './MemoDetail';

export function MemoPanel() {
  const projectId = useAppStore((s) => s.currentProjectId);
  const [items, setItems] = useState<Memo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);

  const loadItems = useCallback(async () => {
    if (!projectId) return;
    try {
      const result = await invoke<unknown[]>('get_memos', { projectId });
      setItems(toCamelCase<Memo[]>(result));
    } catch { /* 無視 */ }
  }, [projectId]);

  useEffect(() => { void loadItems(); }, [loadItems]);

  const loadTags = useCallback(async () => {
    if (!projectId || !selectedId) { setTags([]); return; }
    try {
      const result = await invoke<unknown[]>('get_tags', {
        projectId, entityType: 'memo', entityId: selectedId,
      });
      setTags(toCamelCase<Tag[]>(result));
    } catch { /* 無視 */ }
  }, [projectId, selectedId]);

  useEffect(() => { void loadTags(); }, [loadTags]);

  const handleCreate = useCallback(async () => {
    if (!projectId) return;
    try {
      const id = await invoke<string>('create_memo', {
        projectId, title: '新しいメモ', category: '',
      });
      await loadItems();
      setSelectedId(id);
    } catch { /* 無視 */ }
  }, [projectId, loadItems]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await invoke('delete_memo', { id });
      if (selectedId === id) setSelectedId(null);
      await loadItems();
    } catch { /* 無視 */ }
  }, [selectedId, loadItems]);

  const selected = items.find((i) => i.id === selectedId) ?? null;
  if (!projectId) return null;

  return (
    <div className="flex flex-col h-full">
      {selected ? (
        <MemoDetail
          item={selected}
          tags={tags}
          projectId={projectId}
          onBack={() => setSelectedId(null)}
          onUpdate={loadItems}
          onTagsChange={loadTags}
        />
      ) : (
        <MemoList items={items} onSelect={setSelectedId} onCreate={handleCreate} onDelete={handleDelete} />
      )}
    </div>
  );
}

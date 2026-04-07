/**
 * 用語集パネル — 右パネル内の「用語」タブ
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import { useAppStore } from '@/shared/stores/appStore';
import type { GlossaryItem, Tag } from '@/shared/types';
import { GlossaryList } from './GlossaryList';
import { GlossaryDetail } from './GlossaryDetail';

export function GlossaryPanel() {
  const projectId = useAppStore((s) => s.currentProjectId);
  const [items, setItems] = useState<GlossaryItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);

  const loadItems = useCallback(async () => {
    if (!projectId) return;
    try {
      const result = await invoke<unknown[]>('get_glossary', { projectId });
      setItems(toCamelCase<GlossaryItem[]>(result));
    } catch { /* 無視 */ }
  }, [projectId]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const loadTags = useCallback(async () => {
    if (!projectId || !selectedId) { setTags([]); return; }
    try {
      const result = await invoke<unknown[]>('get_tags', {
        projectId, entityType: 'glossary', entityId: selectedId,
      });
      setTags(toCamelCase<Tag[]>(result));
    } catch { /* 無視 */ }
  }, [projectId, selectedId]);

  useEffect(() => { loadTags(); }, [loadTags]);

  const handleCreate = useCallback(async () => {
    if (!projectId) return;
    try {
      const id = await invoke<string>('create_glossary', {
        projectId, term: '新しい用語', category: '',
      });
      await loadItems();
      setSelectedId(id);
    } catch { /* 無視 */ }
  }, [projectId, loadItems]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await invoke('delete_glossary', { id });
      if (selectedId === id) setSelectedId(null);
      await loadItems();
    } catch { /* 無視 */ }
  }, [selectedId, loadItems]);

  const selected = items.find((i) => i.id === selectedId) ?? null;
  if (!projectId) return null;

  return (
    <div className="flex flex-col h-full">
      {selected ? (
        <GlossaryDetail
          item={selected}
          tags={tags}
          projectId={projectId}
          onBack={() => setSelectedId(null)}
          onUpdate={loadItems}
          onTagsChange={loadTags}
        />
      ) : (
        <GlossaryList
          items={items}
          onSelect={setSelectedId}
          onCreate={handleCreate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

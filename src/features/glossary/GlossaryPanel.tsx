/**
 * 用語集パネル — 右パネル内の「用語」タブ
 *
 * 一覧表示に特化。詳細編集はモーダルで行う。
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import { useAppStore } from '@/shared/stores/appStore';
import type { GlossaryItem, Tag } from '@/shared/types';
import { GlossaryList } from './GlossaryList';
import { GlossaryEditModal } from './GlossaryEditModal';

export function GlossaryPanel() {
  const projectId = useAppStore((s) => s.currentProjectId);
  const [items, setItems] = useState<GlossaryItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);

  const loadItems = useCallback(async () => {
    if (!projectId) return;
    try {
      const result = await invoke<unknown[]>('get_glossary', { projectId });
      setItems(toCamelCase<GlossaryItem[]>(result));
    } catch { /* 無視 */ }
  }, [projectId]);

  useEffect(() => { void loadItems(); }, [loadItems]);

  const loadTags = useCallback(async () => {
    if (!projectId || !editingId) { setTags([]); return; }
    try {
      const result = await invoke<unknown[]>('get_tags', {
        projectId, entityType: 'glossary', entityId: editingId,
      });
      setTags(toCamelCase<Tag[]>(result));
    } catch { /* 無視 */ }
  }, [projectId, editingId]);

  useEffect(() => { void loadTags(); }, [loadTags]);

  const handleCreate = useCallback(async () => {
    if (!projectId) return;
    try {
      const id = await invoke<string>('create_glossary', {
        projectId, term: '新しい用語', category: '',
      });
      await loadItems();
      setEditingId(id);
    } catch { /* 無視 */ }
  }, [projectId, loadItems]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await invoke('delete_glossary', { id });
      if (editingId === id) setEditingId(null);
      await loadItems();
    } catch { /* 無視 */ }
  }, [editingId, loadItems]);

  const editing = items.find((i) => i.id === editingId) ?? null;
  if (!projectId) return null;

  return (
    <div className="flex flex-col h-full">
      <GlossaryList
        items={items}
        onSelect={setEditingId}
        onCreate={handleCreate}
        onDelete={handleDelete}
      />

      {editing && (
        <GlossaryEditModal
          item={editing}
          tags={tags}
          projectId={projectId}
          onClose={() => setEditingId(null)}
          onUpdate={loadItems}
          onTagsChange={loadTags}
        />
      )}
    </div>
  );
}

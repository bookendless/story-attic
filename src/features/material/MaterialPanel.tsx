/**
 * 資料パネル — 右パネル内の「資料」タブ
 *
 * 一覧表示に特化。詳細編集はモーダルで行う。
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import { useAppStore } from '@/shared/stores/appStore';
import type { Material, Tag } from '@/shared/types';
import { MaterialTree } from './MaterialTree';
import { MaterialEditModal } from './MaterialEditModal';

export function MaterialPanel() {
  const projectId = useAppStore((s) => s.currentProjectId);
  const [items, setItems] = useState<Material[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);

  const loadItems = useCallback(async () => {
    if (!projectId) return;
    try {
      const result = await invoke<unknown[]>('get_materials', { projectId });
      setItems(toCamelCase<Material[]>(result));
    } catch { /* 無視 */ }
  }, [projectId]);

  useEffect(() => { void loadItems(); }, [loadItems]);

  const loadTags = useCallback(async () => {
    if (!projectId || !editingId) { setTags([]); return; }
    try {
      const result = await invoke<unknown[]>('get_tags', {
        projectId, entityType: 'material', entityId: editingId,
      });
      setTags(toCamelCase<Tag[]>(result));
    } catch { /* 無視 */ }
  }, [projectId, editingId]);

  useEffect(() => { void loadTags(); }, [loadTags]);

  const handleCreate = useCallback(async () => {
    if (!projectId) return;
    try {
      const id = await invoke<string>('create_material', {
        projectId, title: '新しい資料', book: '', category: '',
      });
      await loadItems();
      setEditingId(id);
    } catch { /* 無視 */ }
  }, [projectId, loadItems]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await invoke('delete_material', { id });
      if (editingId === id) setEditingId(null);
      await loadItems();
    } catch { /* 無視 */ }
  }, [editingId, loadItems]);

  const editing = items.find((i) => i.id === editingId) ?? null;
  if (!projectId) return null;

  return (
    <div className="flex flex-col h-full">
      <MaterialTree items={items} onSelect={setEditingId} onCreate={handleCreate} onDelete={handleDelete} />

      {editing && (
        <MaterialEditModal
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

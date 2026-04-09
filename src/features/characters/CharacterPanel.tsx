/**
 * キャラクターパネル — 右パネル内の「人物」タブ
 *
 * 一覧表示に特化。詳細編集はモーダルで行う。
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import { useAppStore } from '@/shared/stores/appStore';
import type { Character, Tag } from '@/shared/types';
import { CharacterList } from './CharacterList';
import { CharacterEditModal } from './CharacterEditModal';

export function CharacterPanel() {
  const projectId = useAppStore((s) => s.currentProjectId);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);

  const loadCharacters = useCallback(async () => {
    if (!projectId) return;
    try {
      const result = await invoke<unknown[]>('get_characters', { projectId });
      setCharacters(toCamelCase<Character[]>(result));
    } catch {
      /* 無視 */
    }
  }, [projectId]);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  // 編集中キャラクターのタグを取得
  const loadTags = useCallback(async () => {
    if (!projectId || !editingId) {
      setTags([]);
      return;
    }
    try {
      const result = await invoke<unknown[]>('get_tags', {
        projectId,
        entityType: 'character',
        entityId: editingId,
      });
      setTags(toCamelCase<Tag[]>(result));
    } catch {
      /* 無視 */
    }
  }, [projectId, editingId]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const handleCreate = useCallback(async () => {
    if (!projectId) return;
    try {
      const id = await invoke<string>('create_character', {
        projectId,
        name: '新しいキャラクター',
        category: '',
      });
      await loadCharacters();
      setEditingId(id);
    } catch {
      /* 無視 */
    }
  }, [projectId, loadCharacters]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await invoke('delete_character', { id });
      if (editingId === id) setEditingId(null);
      await loadCharacters();
    } catch {
      /* 無視 */
    }
  }, [editingId, loadCharacters]);

  const editing = characters.find((c) => c.id === editingId) ?? null;

  if (!projectId) return null;

  return (
    <div className="flex flex-col h-full">
      <CharacterList
        characters={characters}
        onSelect={setEditingId}
        onCreate={handleCreate}
        onDelete={handleDelete}
        onReload={loadCharacters}
      />

      {/* 編集モーダル */}
      {editing && (
        <CharacterEditModal
          character={editing}
          tags={tags}
          projectId={projectId}
          onClose={() => setEditingId(null)}
          onUpdate={loadCharacters}
          onTagsChange={loadTags}
        />
      )}
    </div>
  );
}

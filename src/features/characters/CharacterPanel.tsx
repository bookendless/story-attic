/**
 * キャラクターパネル — 右パネル内の「人物」タブ
 *
 * リスト表示と詳細表示を切り替える。
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import { useAppStore } from '@/shared/stores/appStore';
import type { Character, Tag } from '@/shared/types';
import { CharacterList } from './CharacterList';
import { CharacterDetail } from './CharacterDetail';

export function CharacterPanel() {
  const projectId = useAppStore((s) => s.currentProjectId);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  // 選択中キャラクターのタグを取得
  const loadTags = useCallback(async () => {
    if (!projectId || !selectedId) {
      setTags([]);
      return;
    }
    try {
      const result = await invoke<unknown[]>('get_tags', {
        projectId,
        entityType: 'character',
        entityId: selectedId,
      });
      setTags(toCamelCase<Tag[]>(result));
    } catch {
      /* 無視 */
    }
  }, [projectId, selectedId]);

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
      setSelectedId(id);
    } catch {
      /* 無視 */
    }
  }, [projectId, loadCharacters]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await invoke('delete_character', { id });
      if (selectedId === id) setSelectedId(null);
      await loadCharacters();
    } catch {
      /* 無視 */
    }
  }, [selectedId, loadCharacters]);

  const selected = characters.find((c) => c.id === selectedId) ?? null;

  if (!projectId) return null;

  return (
    <div className="flex flex-col h-full">
      {selected ? (
        <CharacterDetail
          character={selected}
          tags={tags}
          projectId={projectId}
          onBack={() => setSelectedId(null)}
          onUpdate={loadCharacters}
          onTagsChange={loadTags}
        />
      ) : (
        <CharacterList
          characters={characters}
          onSelect={setSelectedId}
          onCreate={handleCreate}
          onDelete={handleDelete}
          onReload={loadCharacters}
        />
      )}
    </div>
  );
}

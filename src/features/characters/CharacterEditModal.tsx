/**
 * キャラクター編集モーダル — CharacterDetailをモーダルで表示
 *
 * ハイブリッド保存方式:
 * - debounce自動保存を維持
 * - モーダルオープン時にスナップショットを保持
 * - キャンセルでスナップショットに復元
 */

import { useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Character, Tag } from '@/shared/types';
import { CharacterDetail } from './CharacterDetail';

interface CharacterEditModalProps {
  character: Character;
  tags: Tag[];
  projectId: string;
  onClose: () => void;
  onUpdate: () => void;
  onTagsChange: () => void;
}

export function CharacterEditModal({
  character,
  tags,
  projectId,
  onClose,
  onUpdate,
  onTagsChange,
}: CharacterEditModalProps) {
  // モーダルオープン時のスナップショット（キャンセル用）
  const snapshot = useRef({
    name: character.name,
    category: character.category,
    data: character.data,
  });

  const handleCancel = useCallback(async () => {
    // スナップショットの状態に復元
    try {
      await invoke('update_character', {
        id: character.id,
        name: snapshot.current.name,
        category: snapshot.current.category,
        data: snapshot.current.data,
      });
      onUpdate();
    } catch {
      /* 無視 */
    }
    onClose();
  }, [character.id, onClose, onUpdate]);

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div
        className="modal-box"
        style={{ maxWidth: '560px', maxHeight: '85vh', overflow: 'hidden', padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ height: '80vh', maxHeight: '80vh' }}>
          <CharacterDetail
            character={character}
            tags={tags}
            projectId={projectId}
            onBack={onClose}
            onUpdate={onUpdate}
            onTagsChange={onTagsChange}
          />
        </div>

        {/* フッター: 閉じる / キャンセル */}
        <div
          className="flex items-center justify-end gap-2 px-3 py-2 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <button className="btn btn-ghost text-xs" onClick={handleCancel}>
            キャンセル
          </button>
          <button className="btn btn-primary text-xs" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

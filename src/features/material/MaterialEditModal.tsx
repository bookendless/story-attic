/**
 * 資料編集モーダル — MaterialDetailをモーダルで表示
 */

import { useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Material, Tag } from '@/shared/types';
import { MaterialDetail } from './MaterialDetail';

interface MaterialEditModalProps {
  item: Material;
  tags: Tag[];
  projectId: string;
  onClose: () => void;
  onUpdate: () => void;
  onTagsChange: () => void;
}

export function MaterialEditModal({
  item,
  tags,
  projectId,
  onClose,
  onUpdate,
  onTagsChange,
}: MaterialEditModalProps) {
  const snapshot = useRef({
    title: item.title,
    book: item.book,
    category: item.category,
    data: item.data,
  });

  const handleCancel = useCallback(async () => {
    try {
      await invoke('update_material', {
        id: item.id,
        title: snapshot.current.title,
        book: snapshot.current.book,
        category: snapshot.current.category,
        data: snapshot.current.data,
      });
      onUpdate();
    } catch {
      /* 無視 */
    }
    onClose();
  }, [item.id, onClose, onUpdate]);

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div
        className="modal-box"
        style={{ maxWidth: '560px', maxHeight: '85vh', overflow: 'hidden', padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ height: '70vh', maxHeight: '70vh' }}>
          <MaterialDetail
            item={item}
            tags={tags}
            projectId={projectId}
            onBack={onClose}
            onUpdate={onUpdate}
            onTagsChange={onTagsChange}
          />
        </div>
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

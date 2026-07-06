import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useEditorStore } from '@/shared/stores/editorStore';

interface Props {
  projectId: string;
  onClose: () => void;
}

export function ChapterModal({ projectId, onClose }: Props) {
  const { chapterTree, loadChapterTree } = useEditorStore();
  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const chapters = chapterTree?.chapters ?? [];

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title) return;
    await invoke('create_chapter', { projectId, title });
    await loadChapterTree(projectId);
    setNewTitle('');
  };

  const handleRename = async (id: string) => {
    const title = editTitle.trim();
    if (!title) return;
    await invoke('rename_chapter', { id, title });
    await loadChapterTree(projectId);
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この章を削除しますか？（話の割り当ては解除されますが、話は削除されません）')) return;
    await invoke('delete_chapter', { id });
    await loadChapterTree(projectId);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ minWidth: '400px' }}>
        <h2 className="text-base font-medium mb-4" style={{ color: 'var(--text)' }}>
          章管理
        </h2>

        {/* 既存の章一覧 */}
        <div className="mb-4 space-y-1 max-h-64 overflow-y-auto">
          {chapters.length === 0 ? (
            <p className="text-sm py-3 text-center" style={{ color: 'var(--text-muted)' }}>
              章はまだありません
            </p>
          ) : (
            chapters.map(({ chapter }) => (
              <div
                key={chapter.id}
                className="flex items-center gap-2 px-2 py-1 rounded"
                style={{ background: 'var(--bg-surface)' }}
              >
                {editingId === chapter.id ? (
                  <input
                    className="input flex-1 text-sm"
                    style={{ height: '28px', padding: '2px 8px' }}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleRename(chapter.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onBlur={() => handleRename(chapter.id)}
                    autoFocus
                  />
                ) : (
                  <span
                    className="flex-1 text-sm truncate cursor-pointer"
                    style={{ color: 'var(--text)' }}
                    onDoubleClick={() => {
                      setEditingId(chapter.id);
                      setEditTitle(chapter.title);
                    }}
                    title="ダブルクリックで編集"
                  >
                    {chapter.title}
                  </span>
                )}
                <button
                  className="text-xs btn btn-ghost"
                  style={{ padding: '2px 8px', color: 'var(--danger)' }}
                  onClick={() => handleDelete(chapter.id)}
                >
                  削除
                </button>
              </div>
            ))
          )}
        </div>

        {/* 新規作成 */}
        <div className="flex gap-2 mb-4">
          <input
            className="input flex-1 text-sm"
            placeholder="新しい章のタイトル"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreate();
            }}
          />
          <button
            className="btn btn-primary text-xs flex-shrink-0"
            onClick={handleCreate}
            disabled={!newTitle.trim()}
          >
            追加
          </button>
        </div>

        <div className="flex justify-end">
          <button className="btn btn-ghost" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

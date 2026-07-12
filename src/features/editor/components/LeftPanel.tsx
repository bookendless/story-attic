import { useState, useRef, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAppStore } from '@/shared/stores/appStore';
import { useEditorStore } from '@/shared/stores/editorStore';
import type { Chapter, ChapterWithEpisodes, EpisodeSummary } from '@/shared/types';
import { ChapterModal } from './ChapterModal';

// =========================================
// 右クリックコンテキストメニュー
// =========================================
interface ContextMenuState {
  x: number;
  y: number;
  episode: EpisodeSummary;
  isInChapter: boolean;
}

interface ContextMenuProps extends ContextMenuState {
  chapters: Chapter[];
  onRename: () => void;
  onDelete: () => void;
  onAssign: (chapterId: string) => void;
  onUnassign: () => void;
  onClose: () => void;
}

function EpisodeContextMenu({
  x, y, episode, isInChapter, chapters,
  onRename, onDelete, onAssign, onUnassign, onClose,
}: ContextMenuProps) {
  const [showChapterList, setShowChapterList] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 画面端のクリップ処理
  const [pos, setPos] = useState({ x, y });
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setPos({
      x: x + rect.width > vw ? x - rect.width : x,
      y: y + rect.height > vh ? y - rect.height : y,
    });
  }, [x, y]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const menuItemStyle = {
    width: '100%',
    textAlign: 'left' as const,
    padding: '6px 14px',
    fontSize: '12px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-mid)',
    transition: 'background 100ms',
  };

  const MenuItem = ({
    label,
    danger = false,
    onClick,
  }: {
    label: string;
    danger?: boolean;
    onClick: () => void;
  }) => (
    <button
      style={{ ...menuItemStyle, color: danger ? 'var(--danger)' : 'var(--text-mid)' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)';
        (e.currentTarget as HTMLElement).style.color = danger ? 'var(--danger)' : 'var(--text)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
        (e.currentTarget as HTMLElement).style.color = danger ? 'var(--danger)' : 'var(--text-mid)';
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 100,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-light)',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(20,16,12,0.5)',
        minWidth: '160px',
        padding: '4px 0',
      }}
    >
      <div className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--border)', marginBottom: '2px' }}>
        <p className="text-xs truncate max-w-36" style={{ color: 'var(--text-muted)' }}>
          {episode.title}
        </p>
      </div>

      <MenuItem label="✏ 名前を変更" onClick={() => { onRename(); onClose(); }} />

      {/* 章へ割り当て */}
      {chapters.length > 0 && (
        <>
          <button
            style={{ ...menuItemStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)';
              (e.currentTarget as HTMLElement).style.color = 'var(--text)';
              setShowChapterList(true);
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-mid)';
            }}
          >
            <span>📂 章に割り当て</span>
            <span style={{ fontSize: '10px', opacity: 0.6 }}>▶</span>
          </button>
          {showChapterList && (
            <div
              style={{
                position: 'absolute',
                left: '100%',
                top: '36px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-light)',
                borderRadius: '8px',
                boxShadow: '0 8px 24px rgba(20,16,12,0.5)',
                minWidth: '140px',
                padding: '4px 0',
              }}
              onMouseEnter={() => setShowChapterList(true)}
              onMouseLeave={() => setShowChapterList(false)}
            >
              {chapters.map((ch) => (
                <MenuItem
                  key={ch.id}
                  label={ch.title}
                  onClick={() => { onAssign(ch.id); onClose(); }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {isInChapter && (
        <MenuItem label="↩ 章の割り当てを解除" onClick={() => { onUnassign(); onClose(); }} />
      )}

      <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
      <MenuItem label="🗑 削除" danger onClick={() => { onDelete(); onClose(); }} />
    </div>
  );
}

// =========================================
// 削除確認ダイアログ
// =========================================
function DeleteEpisodeDialog({
  title,
  onConfirm,
  onClose,
}: {
  title: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-medium mb-2" style={{ color: 'var(--text)' }}>
          話を削除しますか？
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-mid)' }}>
          「<strong style={{ color: 'var(--text)' }}>{title}</strong>」を削除します。
          この操作は取り消せません。
        </p>
        <div className="flex justify-end gap-3">
          <button className="btn btn-ghost" onClick={onClose}>キャンセル</button>
          <button className="btn btn-danger" onClick={onConfirm}>削除する</button>
        </div>
      </div>
    </div>
  );
}

// =========================================
// ゴミ箱ドロップゾーン
// =========================================
function TrashDropZone() {
  const { isOver, setNodeRef } = useDroppable({ id: 'trash' });

  return (
    <div
      ref={setNodeRef}
      style={{
        margin: '6px 8px 8px',
        padding: '8px 12px',
        borderRadius: '8px',
        border: `2px dashed ${isOver ? 'var(--danger)' : 'var(--border)'}`,
        background: isOver ? 'rgba(180,60,60,0.1)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '12px',
        color: isOver ? 'var(--danger)' : 'var(--text-muted)',
        transition: 'border-color 120ms, background 120ms, color 120ms',
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: '14px' }}>🗑</span>
      <span>ここにドロップして削除</span>
    </div>
  );
}

// =========================================
// 左パネル本体
// =========================================
export function LeftPanel() {
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const chapterTree = useEditorStore((s) => s.chapterTree);
  const currentEpisode = useEditorStore((s) => s.currentEpisode);
  const switchEpisode = useEditorStore((s) => s.switchEpisode);
  const createEpisode = useEditorStore((s) => s.createEpisode);
  const renameEpisode = useEditorStore((s) => s.renameEpisode);
  const deleteEpisode = useEditorStore((s) => s.deleteEpisode);
  const reorderEpisodes = useEditorStore((s) => s.reorderEpisodes);
  const assignEpisodeToChapter = useEditorStore((s) => s.assignEpisodeToChapter);
  const unassignEpisode = useEditorStore((s) => s.unassignEpisode);
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EpisodeSummary | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findEpisodeById = useCallback((id: string): EpisodeSummary | null => {
    if (!chapterTree) return null;
    const all = [
      ...chapterTree.ungrouped,
      ...chapterTree.chapters.flatMap((c) => c.episodes),
    ];
    return all.find((e) => e.id === id) ?? null;
  }, [chapterTree]);

  const handleAddEpisode = async () => {
    if (!currentProjectId) return;
    const allEpisodes = [
      ...(chapterTree?.chapters.flatMap((c) => c.episodes) ?? []),
      ...(chapterTree?.ungrouped ?? []),
    ];
    const id = await createEpisode(currentProjectId, `第${allEpisodes.length + 1}話`);
    await switchEpisode(id);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setIsDragging(false);
    const { active, over } = event;
    if (!over || !currentProjectId) return;

    const overId = String(over.id);
    const activeId = String(active.id);

    if (overId === 'trash') {
      const ep = findEpisodeById(activeId);
      if (ep) setDeleteTarget(ep);
      return;
    }

    if (overId.startsWith('chapter-')) {
      const chapterId = overId.replace('chapter-', '');
      await assignEpisodeToChapter(activeId, chapterId);
      return;
    }

    // 未分類内の並び替え
    const ungrouped = chapterTree?.ungrouped ?? [];
    const oldIndex = ungrouped.findIndex((e) => e.id === activeId);
    const newIndex = ungrouped.findIndex((e) => e.id === overId);
    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = [...ungrouped];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);
      await reorderEpisodes(currentProjectId, reordered.map((e) => e.id));
    }
  };

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, episode: EpisodeSummary, isInChapter: boolean) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, episode, isInChapter });
    },
    [],
  );

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteEpisode(deleteTarget.id);
    setDeleteTarget(null);
  };

  const allChapters = chapterTree?.chapters.map((c) => c.chapter) ?? [];

  if (!chapterTree) {
    return (
      <div className="h-full flex items-center justify-center text-xs panel" style={{ color: 'var(--text-muted)' }}>
        読み込み中...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col panel overflow-hidden">
      {/* パネルヘッダー */}
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>目次</span>
        <div className="flex gap-1">
          <button
            className="btn btn-ghost"
            style={{ padding: '2px 8px', fontSize: '11px' }}
            onClick={() => setShowChapterModal(true)}
            title="章管理"
          >
            章
          </button>
          <button
            className="btn btn-ghost"
            style={{ padding: '2px 8px', fontSize: '16px', lineHeight: 1 }}
            onClick={handleAddEpisode}
            title="話を追加"
          >
            ＋
          </button>
        </div>
      </div>

      {/* DnD全体コンテキスト */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setIsDragging(false)}
      >
        {/* スクロールエリア */}
        <div className="flex-1 overflow-y-auto py-1">
          {chapterTree.chapters.map((cwe) => (
            <ChapterGroup
              key={cwe.chapter.id}
              data={cwe}
              currentEpisodeId={currentEpisode?.id ?? null}
              onSelectEpisode={switchEpisode}
              onRenameEpisode={renameEpisode}
              onContextMenu={(e, ep) => handleContextMenu(e, ep, true)}
              isDragging={isDragging}
            />
          ))}

          {chapterTree.ungrouped.length > 0 && (
            <div>
              {chapterTree.chapters.length > 0 && (
                <div className="px-3 pt-3 pb-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  未分類
                </div>
              )}
              <SortableContext
                items={chapterTree.ungrouped.map((e) => e.id)}
                strategy={verticalListSortingStrategy}
              >
                {chapterTree.ungrouped.map((episode) => (
                  <SortableEpisodeItem
                    key={episode.id}
                    episode={episode}
                    isActive={episode.id === currentEpisode?.id}
                    onSelect={() => switchEpisode(episode.id)}
                    onRename={renameEpisode}
                    onContextMenu={(e) => handleContextMenu(e, episode, false)}
                  />
                ))}
              </SortableContext>
            </div>
          )}

          {chapterTree.chapters.length === 0 && chapterTree.ungrouped.length === 0 && (
            <div className="px-3 py-6 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              ＋ボタンで話を追加
            </div>
          )}
        </div>

        {/* ゴミ箱ゾーン（ドラッグ中のみ表示） */}
        {isDragging && <TrashDropZone />}
      </DndContext>

      {/* 章管理モーダル */}
      {showChapterModal && currentProjectId && (
        <ChapterModal projectId={currentProjectId} onClose={() => setShowChapterModal(false)} />
      )}

      {/* 右クリックメニュー */}
      {contextMenu && (
        <EpisodeContextMenu
          {...contextMenu}
          chapters={allChapters}
          onRename={() => {
            setContextMenu(null);
          }}
          onDelete={() => {
            setDeleteTarget(contextMenu.episode);
            setContextMenu(null);
          }}
          onAssign={(chapterId) => {
            void assignEpisodeToChapter(contextMenu.episode.id, chapterId);
          }}
          onUnassign={() => {
            void unassignEpisode(contextMenu.episode.id);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* 削除確認 */}
      {deleteTarget && (
        <DeleteEpisodeDialog
          title={deleteTarget.title}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// =========================================
// 章グループ（ドロップ可能な章ヘッダー）
// =========================================
interface ChapterGroupProps {
  data: ChapterWithEpisodes;
  currentEpisodeId: string | null;
  onSelectEpisode: (id: string) => void;
  onRenameEpisode: (id: string, title: string) => Promise<void>;
  onContextMenu: (e: React.MouseEvent, episode: EpisodeSummary) => void;
  isDragging: boolean;
}

function ChapterGroup({
  data, currentEpisodeId, onSelectEpisode, onRenameEpisode, onContextMenu, isDragging,
}: ChapterGroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { isOver, setNodeRef } = useDroppable({ id: `chapter-${data.chapter.id}` });

  return (
    <div>
      <button
        ref={setNodeRef}
        className="w-full flex items-center gap-1 px-3 py-1.5 text-left"
        style={{
          color: 'var(--text-mid)',
          fontSize: '12px',
          background: isOver ? 'var(--accent-soft)' : 'transparent',
          outline: isOver ? '2px solid rgba(196,149,106,0.35)' : 'none',
          outlineOffset: '-2px',
          transition: 'background 120ms, outline 120ms',
        }}
        onMouseEnter={(e) => {
          if (!isOver) (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)';
        }}
        onMouseLeave={(e) => {
          if (!isOver) (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span style={{ fontSize: '10px', opacity: 0.6 }}>{collapsed ? '▷' : '▽'}</span>
        <span className="truncate font-medium">{data.chapter.title}</span>
        <span className="ml-auto text-xs opacity-50">{data.episodes.length}</span>
        {isDragging && (
          <span style={{ fontSize: '9px', color: 'var(--accent)', opacity: 0.7, marginLeft: '4px', flexShrink: 0 }}>
            ← drop
          </span>
        )}
      </button>
      {!collapsed &&
        data.episodes.map((episode) => (
          <DraggableEpisodeItem
            key={episode.id}
            episode={episode}
            isActive={episode.id === currentEpisodeId}
            onSelect={() => onSelectEpisode(episode.id)}
            onRename={onRenameEpisode}
            onContextMenu={(e) => onContextMenu(e, episode)}
          />
        ))}
    </div>
  );
}

// =========================================
// エピソードアイテム（インラインリネーム対応）
// =========================================
interface EpisodeItemProps {
  episode: EpisodeSummary;
  isActive: boolean;
  onSelect: () => void;
  onRename: (id: string, title: string) => Promise<void>;
  onContextMenu: (e: React.MouseEvent) => void;
  indent?: boolean;
}

function EpisodeItem({ episode, isActive, onSelect, onRename, onContextMenu, indent }: EpisodeItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setEditValue(episode.title);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.select(), 30);
  };

  const commitEdit = async () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== episode.title) {
      await onRename(episode.id, trimmed);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div
        style={{
          paddingLeft: indent ? '24px' : '10px',
          paddingRight: '8px',
          paddingTop: '2px',
          paddingBottom: '2px',
        }}
      >
        <input
          ref={inputRef}
          className="input text-xs w-full"
          style={{ height: '26px', padding: '2px 6px' }}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void commitEdit();
            if (e.key === 'Escape') setIsEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <button
      className="w-full flex items-center gap-2 py-1.5 text-left group"
      style={{
        paddingLeft: indent ? '28px' : '12px',
        paddingRight: '8px',
        background: isActive ? 'var(--accent-soft)' : 'transparent',
        borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
        color: isActive ? 'var(--text)' : 'var(--text-mid)',
        fontSize: '13px',
      }}
      onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
      onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      onClick={onSelect}
      onDoubleClick={(e) => { e.preventDefault(); startEdit(); }}
      onContextMenu={onContextMenu}
    >
      <span className="truncate flex-1 text-left">{episode.title}</span>
      <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
        {episode.charCount > 0 ? episode.charCount.toLocaleString() : ''}
      </span>
    </button>
  );
}

// =========================================
// ドラッグ可能なエピソードアイテム（章内エピソード用）
// =========================================
function DraggableEpisodeItem({
  episode, isActive, onSelect, onRename, onContextMenu,
}: Omit<EpisodeItemProps, 'indent'>) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({ id: episode.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.4 : 1,
        display: 'flex',
        alignItems: 'center',
      }}
      {...attributes}
    >
      <span
        {...listeners}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing select-none"
        style={{ color: 'var(--text-muted)', paddingLeft: '6px', paddingRight: '2px', fontSize: '12px' }}
        title="ドラッグして章を変更"
      >
        ⠿
      </span>
      <div className="flex-1 min-w-0">
        <EpisodeItem
          episode={episode}
          isActive={isActive}
          onSelect={onSelect}
          onRename={onRename}
          onContextMenu={onContextMenu}
          indent
        />
      </div>
    </div>
  );
}

// =========================================
// ソート可能なエピソードアイテム（未分類用）
// =========================================
interface SortableEpisodeItemProps {
  episode: EpisodeSummary;
  isActive: boolean;
  onSelect: () => void;
  onRename: (id: string, title: string) => Promise<void>;
  onContextMenu: (e: React.MouseEvent) => void;
}

function SortableEpisodeItem({ episode, isActive, onSelect, onRename, onContextMenu }: SortableEpisodeItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: episode.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        display: 'flex',
        alignItems: 'center',
      }}
      {...attributes}
    >
      {/* ドラッグハンドル */}
      <span
        {...listeners}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing select-none"
        style={{ color: 'var(--text-muted)', paddingLeft: '6px', paddingRight: '2px', fontSize: '12px' }}
        title="ドラッグして並べ替え"
      >
        ⠿
      </span>
      <div className="flex-1 min-w-0">
        <EpisodeItem
          episode={episode}
          isActive={isActive}
          onSelect={onSelect}
          onRename={onRename}
          onContextMenu={onContextMenu}
        />
      </div>
    </div>
  );
}

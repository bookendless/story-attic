/**
 * 章立てパネル — 右パネル「章立て」タブ。
 * サブタブ: 章立て（中プロット・ノードツリー + DnD並び替え）/ タイムライン
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import { useAppStore } from '@/shared/stores/appStore';
import { useEditorStore } from '@/shared/stores/editorStore';
import type { ChapterNode, ChapterWithEpisodes, Timeline } from '@/shared/types';
import { ChapterDetail } from './ChapterDetail';
import { TimelineTable } from '../plot/TimelineTable';
import { TimelineModal } from '../plot/TimelineModal';

type SubTab = 'chapters' | 'timeline';

// ---------- ノードツリーユーティリティ ----------

function newNodeId(): string {
  return `cn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function parseNodes(raw: string): ChapterNode[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.nodes) ? parsed.nodes : [];
  } catch {
    return [];
  }
}

function addChildNode(nodes: ChapterNode[], parentId: string): ChapterNode[] {
  return nodes.map((n) =>
    n.id === parentId
      ? { ...n, children: [...n.children, { id: newNodeId(), label: '新しいノード', content: '', children: [] }] }
      : { ...n, children: addChildNode(n.children, parentId) },
  );
}

function removeNode(nodes: ChapterNode[], targetId: string): ChapterNode[] {
  return nodes
    .filter((n) => n.id !== targetId)
    .map((n) => ({ ...n, children: removeNode(n.children, targetId) }));
}

function updateNode(
  nodes: ChapterNode[],
  targetId: string,
  field: 'label' | 'content',
  value: string,
): ChapterNode[] {
  return nodes.map((n) =>
    n.id === targetId
      ? { ...n, [field]: value }
      : { ...n, children: updateNode(n.children, targetId, field, value) },
  );
}

// ---------- メインパネル ----------

export function ChapterPanel() {
  const projectId = useAppStore((s) => s.currentProjectId);
  const chapterTree = useEditorStore((s) => s.chapterTree);
  const loadChapterTree = useEditorStore((s) => s.loadChapterTree);

  const [subTab, setSubTab] = useState<SubTab>('chapters');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timelines, setTimelines] = useState<Timeline[]>([]);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chapters = useMemo(() => chapterTree?.chapters ?? [], [chapterTree]);

  const reload = useCallback(async () => {
    if (!projectId) return;
    await loadChapterTree(projectId);
  }, [projectId, loadChapterTree]);

  const loadTimelines = useCallback(async () => {
    if (!projectId) return;
    try {
      const result = await invoke<unknown[]>('get_timelines', { projectId });
      setTimelines(toCamelCase<Timeline[]>(result));
    } catch { /* 無視 */ }
  }, [projectId]);

  useEffect(() => {
    loadTimelines();
  }, [loadTimelines]);

  useEffect(() => () => {
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!projectId) return;
    try {
      const id = await invoke<string>('create_chapter', { projectId, title: '新しい章' });
      await reload();
      setSelectedId(id);
    } catch { /* 無視 */ }
  }, [projectId, reload]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await invoke('delete_chapter', { id });
      if (selectedId === id) setSelectedId(null);
      await reload();
    } catch { /* 無視 */ }
  }, [selectedId, reload]);

  if (!projectId) return null;

  // 章詳細ビュー（ダブルクリック時）
  const selected = chapters.find((c) => c.chapter.id === selectedId);
  if (selected) {
    return (
      <ChapterDetail
        chapter={selected.chapter}
        episodeCount={selected.episodes.length}
        onBack={() => setSelectedId(null)}
        onUpdate={reload}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* サブタブバー */}
      <div
        className="flex items-center gap-0.5 px-2 pt-1 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {([['chapters', '章立て'], ['timeline', 'タイムライン']] as [SubTab, string][]).map(([key, label]) => (
          <button
            key={key}
            className="text-xs px-2 py-1 whitespace-nowrap"
            style={{
              color: subTab === key ? 'var(--accent)' : 'var(--text-muted)',
              background: 'none',
              border: 'none',
              borderBottom: subTab === key ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
            }}
            onClick={() => setSubTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-hidden">
        {subTab === 'chapters' && (
          <ChapterOutlineTab
            projectId={projectId}
            chapters={chapters}
            onReload={reload}
            onOpenDetail={(id) => setSelectedId(id)}
            onDelete={handleDelete}
            onCreate={handleCreate}
          />
        )}
        {subTab === 'timeline' && (
          <TimelineTable
            projectId={projectId}
            timelines={timelines}
            onReload={loadTimelines}
            onExpand={() => setShowTimelineModal(true)}
          />
        )}
      </div>

      {showTimelineModal && (
        <TimelineModal
          projectId={projectId}
          timelines={timelines}
          onReload={loadTimelines}
          onClose={() => setShowTimelineModal(false)}
        />
      )}
    </div>
  );
}

// ---------- 章立てタブ ----------

interface ChapterOutlineTabProps {
  projectId: string;
  chapters: ChapterWithEpisodes[];
  onReload: () => Promise<void>;
  onOpenDetail: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onCreate: () => Promise<void>;
}

function ChapterOutlineTab({
  projectId,
  chapters,
  onReload,
  onOpenDetail,
  onDelete,
  onCreate,
}: ChapterOutlineTabProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = chapters.findIndex((c) => c.chapter.id === active.id);
      const newIndex = chapters.findIndex((c) => c.chapter.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(chapters, oldIndex, newIndex);
      const orderedIds = reordered.map((c) => c.chapter.id);

      try {
        await invoke('reorder_chapters', { projectId, orderedIds });
        await onReload();
      } catch { /* 無視 */ }
    },
    [chapters, projectId, onReload],
  );

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          章立て（{chapters.length}件）
        </span>
        <button
          onClick={onCreate}
          className="text-xs px-2 py-1 rounded"
          style={{ background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          ＋追加
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {chapters.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs" style={{ color: 'var(--text-muted)' }}>
            章がありません
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={chapters.map((c) => c.chapter.id)}
              strategy={verticalListSortingStrategy}
            >
              {chapters.map((cwe, idx) => (
                <SortableChapterCard
                  key={cwe.chapter.id}
                  cwe={cwe}
                  index={idx + 1}
                  onOpenDetail={onOpenDetail}
                  onDelete={onDelete}
                  onNodesChange={onReload}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

// ---------- ソータブル章カード ----------

interface SortableChapterCardProps {
  cwe: ChapterWithEpisodes;
  index: number;
  onOpenDetail: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onNodesChange: () => Promise<void>;
}

function SortableChapterCard({ cwe, index, onOpenDetail, onDelete, onNodesChange }: SortableChapterCardProps) {
  const { chapter, episodes } = cwe;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chapter.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [expanded, setExpanded] = useState(false);
  const [nodes, setNodes] = useState<ChapterNode[]>(() => parseNodes(chapter.nodes));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 章のノードデータが外部から更新されたら同期
  useEffect(() => {
    setNodes(parseNodes(chapter.nodes));
  }, [chapter.nodes]);

  const saveNodes = useCallback(
    (next: ChapterNode[]) => {
      setNodes(next);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await invoke('update_chapter_nodes', {
            id: chapter.id,
            nodes: JSON.stringify({ nodes: next }),
          });
          await onNodesChange();
        } catch { /* 無視 */ }
      }, 500);
    },
    [chapter.id, onNodesChange],
  );

  const handleClick = () => {
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      setExpanded((v) => !v);
      clickTimerRef.current = null;
    }, 220);
  };

  const handleDoubleClick = () => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    onOpenDetail(chapter.id);
  };

  return (
    <div ref={setNodeRef} style={{ ...style, borderBottom: '1px solid var(--border)' }}>
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {/* DnD ハンドル */}
        <span
          className="flex-shrink-0 cursor-grab"
          style={{ color: 'var(--text-muted)', fontSize: '12px', touchAction: 'none' }}
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          ⠿
        </span>
        <span style={{ fontSize: '10px', opacity: 0.6, width: '10px', flexShrink: 0 }}>
          {expanded ? '▽' : '▷'}
        </span>
        <span
          className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
        >
          第{index}章
        </span>
        <div
          className="text-sm truncate font-medium flex-1 min-w-0"
          style={{ color: 'var(--text-primary)' }}
        >
          {chapter.title || '（タイトルなし）'}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(chapter.id); }}
          onDoubleClick={(e) => e.stopPropagation()}
          className="text-xs flex-shrink-0 px-1.5 py-0.5 rounded"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
          title="削除"
        >
          ✕
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pl-10">
          {/* 概要 */}
          {chapter.summary ? (
            <div className="text-xs mb-2" style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
              {chapter.summary}
            </div>
          ) : (
            <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>（概要なし）</div>
          )}
          <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            エピソード {episodes.length} 件
          </div>

          {/* ノードツリー */}
          <ChapterNodeList
            nodes={nodes}
            depth={0}
            onAddChild={(parentId) => saveNodes(addChildNode(nodes, parentId))}
            onRemove={(id) => saveNodes(removeNode(nodes, id))}
            onUpdate={(id, field, value) => saveNodes(updateNode(nodes, id, field, value))}
          />
          <button
            className="text-xs mt-1 px-2 py-0.5 rounded w-full"
            style={{ color: 'var(--accent)', background: 'none', border: '1px dashed var(--border)', cursor: 'pointer' }}
            onClick={() => {
              const node: ChapterNode = { id: newNodeId(), label: '新しいノード', content: '', children: [] };
              saveNodes([...nodes, node]);
            }}
          >
            + ノード追加
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- 章ノードツリー ----------

function ChapterNodeList({
  nodes, depth, onAddChild, onRemove, onUpdate,
}: {
  nodes: ChapterNode[];
  depth: number;
  onAddChild: (parentId: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: 'label' | 'content', value: string) => void;
}) {
  return (
    <div style={{ paddingLeft: depth > 0 ? '12px' : '0', borderLeft: depth > 0 ? '1px solid var(--border)' : 'none' }}>
      {nodes.map((node) => (
        <ChapterNodeItem
          key={node.id}
          node={node}
          depth={depth}
          onAddChild={onAddChild}
          onRemove={onRemove}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}

function ChapterNodeItem({
  node, depth, onAddChild, onRemove, onUpdate,
}: {
  node: ChapterNode;
  depth: number;
  onAddChild: (parentId: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: 'label' | 'content', value: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mb-1">
      <div className="flex items-center gap-1">
        {node.children.length > 0 ? (
          <button
            className="text-xs flex-shrink-0"
            style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', width: '14px' }}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? '▼' : '▶'}
          </button>
        ) : (
          <span style={{ width: '14px', display: 'inline-block' }} />
        )}
        <input
          className="flex-1 text-xs font-medium bg-transparent outline-none"
          style={{ color: 'var(--text)', border: 'none', padding: '1px 2px' }}
          value={node.label}
          onChange={(e) => onUpdate(node.id, 'label', e.target.value)}
        />
        <button
          className="text-xs flex-shrink-0"
          style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px' }}
          onClick={() => onAddChild(node.id)}
          title="子ノード追加"
        >
          +子
        </button>
        <button
          className="text-xs flex-shrink-0"
          style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px' }}
          onClick={() => onRemove(node.id)}
          title="削除"
        >
          ×
        </button>
      </div>
      <textarea
        className="w-full text-xs bg-transparent outline-none resize-y mt-0.5"
        style={{
          color: 'var(--text-mid)',
          border: '1px solid var(--border)',
          borderRadius: '3px',
          padding: '3px 5px',
          minHeight: '50px',
          maxHeight: '300px',
          marginLeft: '14px',
          width: 'calc(100% - 14px)',
        }}
        value={node.content}
        onChange={(e) => onUpdate(node.id, 'content', e.target.value)}
        placeholder="内容..."
        rows={1}
      />
      {expanded && node.children.length > 0 && (
        <ChapterNodeList
          nodes={node.children}
          depth={depth + 1}
          onAddChild={onAddChild}
          onRemove={onRemove}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}

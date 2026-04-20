/**
 * プロットツリー — 大プロット（全体構造把握）
 *
 * タイプドロップダウンで1タイプ1パターンを即時ロード/自動作成。
 * ノードツリーは常時表示。選択タイプはlocalStorageに永続化。
 * ピン留め（決定稿）はDBに保存し将来のAI読み込み対象となる。
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Plot, PlotData, PlotNode } from '@/shared/types';
import { DEFAULT_PLOT_DATA, PLOT_TYPE_PRESETS } from '@/shared/types';
import {
  PLOT_STRUCTURE_TYPES,
  PLOT_STRUCTURE_LABELS,
  PLOT_STRUCTURE_PHASES,
} from '@/shared/constants/asbEnums';
import type { PlotStructureType } from '@/shared/constants/asbEnums';

const ALL_TYPES = [...PLOT_STRUCTURE_TYPES, 'カスタム'] as string[];

function storageKey(projectId: string) {
  return `story-attic-plot-type-${projectId}`;
}

interface PlotTreeProps {
  projectId: string;
  plots: Plot[];
  onReload: () => void;
}

function parseData(raw: string): PlotData {
  try {
    const parsed = JSON.parse(raw);
    return { nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [] };
  } catch {
    return { ...DEFAULT_PLOT_DATA };
  }
}

function newNodeId(): string {
  return `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function resolveInitialType(projectId: string, plots: Plot[]): string {
  // ピン留め済みのタイプを優先
  const pinned = plots.find((p) => p.isPinned);
  if (pinned) return pinned.plotType;
  // 次にlocalStorageの前回選択
  const stored = localStorage.getItem(storageKey(projectId));
  if (stored && ALL_TYPES.includes(stored)) return stored;
  return ALL_TYPES[0];
}

export function PlotTree({ projectId, plots, onReload }: PlotTreeProps) {
  const [selectedType, setSelectedType] = useState<string>(() => resolveInitialType(projectId, plots));
  const [editingNodes, setEditingNodes] = useState<PlotNode[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentPlot = plots.find((p) => p.plotType === selectedType) ?? null;
  const isPinned = currentPlot?.isPinned ?? false;

  // タイプ切り替え時またはプロットロード完了時にノードを同期
  useEffect(() => {
    if (currentPlot) {
      setEditingNodes(parseData(currentPlot.data).nodes);
    } else {
      setEditingNodes([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlot?.id]);

  // 選択タイプのプロットが存在しない場合は自動作成
  useEffect(() => {
    if (!currentPlot && !isCreating) {
      setIsCreating(true);
      invoke<string>('create_plot', {
        projectId,
        title: selectedType,
        plotType: selectedType,
      })
        .then(() => onReload())
        .catch(() => {})
        .finally(() => setIsCreating(false));
    }
  }, [selectedType, currentPlot, isCreating, projectId, onReload]);

  const handleTypeChange = (type: string) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    setSelectedType(type);
    localStorage.setItem(storageKey(projectId), type);
  };

  const handlePin = useCallback(async () => {
    if (!currentPlot) return;
    try {
      if (isPinned) {
        await invoke('unpin_plot', { projectId });
      } else {
        await invoke('pin_plot', { projectId, plotId: currentPlot.id });
      }
      onReload();
    } catch { /* 無視 */ }
  }, [currentPlot, isPinned, projectId, onReload]);

  const saveNodes = useCallback(
    (nodes: PlotNode[]) => {
      if (!currentPlot) return;
      setEditingNodes(nodes);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await invoke('update_plot', {
            id: currentPlot.id,
            title: currentPlot.title,
            plotType: currentPlot.plotType,
            theme: currentPlot.theme,
            data: JSON.stringify({ nodes }),
          });
          onReload();
        } catch { /* 無視 */ }
      }, 500);
    },
    [currentPlot, onReload],
  );

  const addRootNode = useCallback(() => {
    const node: PlotNode = { id: newNodeId(), label: '新しいノード', content: '', children: [] };
    saveNodes([...editingNodes, node]);
  }, [editingNodes, saveNodes]);

  const addChildNode = (nodes: PlotNode[], parentId: string): PlotNode[] =>
    nodes.map((n) =>
      n.id === parentId
        ? { ...n, children: [...n.children, { id: newNodeId(), label: '新しいノード', content: '', children: [] }] }
        : { ...n, children: addChildNode(n.children, parentId) },
    );

  const removeNode = (nodes: PlotNode[], targetId: string): PlotNode[] =>
    nodes
      .filter((n) => n.id !== targetId)
      .map((n) => ({ ...n, children: removeNode(n.children, targetId) }));

  const updateNode = (nodes: PlotNode[], targetId: string, field: 'label' | 'content', value: string): PlotNode[] =>
    nodes.map((n) =>
      n.id === targetId ? { ...n, [field]: value } : { ...n, children: updateNode(n.children, targetId, field, value) },
    );

  const generateNodes = useCallback(() => {
    const phases = PLOT_STRUCTURE_PHASES[selectedType as PlotStructureType];
    if (phases) {
      const nodes = phases.map((p) => ({ id: newNodeId(), label: p.label, content: p.description, children: [] }));
      saveNodes(nodes);
      return;
    }
    const preset = PLOT_TYPE_PRESETS[selectedType] ?? [];
    if (preset.length > 0) {
      saveNodes(preset.map((label) => ({ id: newNodeId(), label, content: '', children: [] })));
    } else {
      addRootNode();
    }
  }, [selectedType, saveNodes, addRootNode]);

  return (
    <div className="flex flex-col h-full">
      {/* タイプセレクター + ピン留め */}
      <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-1.5">
          <select
            className="flex-1 text-xs outline-none"
            style={{
              color: 'var(--text)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '4px 6px',
            }}
            value={selectedType}
            onChange={(e) => handleTypeChange(e.target.value)}
            disabled={isCreating}
          >
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>
                {PLOT_STRUCTURE_LABELS[t as PlotStructureType] ?? t}
              </option>
            ))}
          </select>
          <button
            onClick={handlePin}
            disabled={!currentPlot}
            title={isPinned ? '決定稿を解除' : '決定稿に設定（AIの読み込み対象）'}
            className="text-xs px-2 py-1 rounded flex-shrink-0"
            style={{
              background: isPinned ? 'var(--accent)' : 'var(--bg-elevated)',
              color: isPinned ? 'var(--bg-deep)' : 'var(--text-muted)',
              border: `1px solid ${isPinned ? 'var(--accent)' : 'var(--border)'}`,
              cursor: currentPlot ? 'pointer' : 'default',
              opacity: currentPlot ? 1 : 0.4,
            }}
          >
            {isPinned ? '📌 決定稿' : '📌'}
          </button>
        </div>
        {isCreating && (
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>作成中...</div>
        )}
        {isPinned && (
          <div className="text-xs mt-1" style={{ color: 'var(--accent)', opacity: 0.8 }}>
            この構成が決定稿として設定されています
          </div>
        )}
      </div>

      {/* ノードツリー（常時表示） */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {!currentPlot && !isCreating && (
          <div className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>読み込み中...</div>
        )}
        {currentPlot && editingNodes.length === 0 && (
          <div className="text-center py-4">
            <button
              className="text-xs px-3 py-1 rounded"
              style={{ background: 'var(--accent)', color: 'var(--bg-deep)', border: 'none', cursor: 'pointer' }}
              onClick={generateNodes}
            >
              ノードを生成
            </button>
          </div>
        )}
        <NodeList
          nodes={editingNodes}
          depth={0}
          onAddChild={(parentId) => saveNodes(addChildNode(editingNodes, parentId))}
          onRemove={(id) => saveNodes(removeNode(editingNodes, id))}
          onUpdate={(id, field, value) => saveNodes(updateNode(editingNodes, id, field, value))}
        />
        {editingNodes.length > 0 && (
          <button
            className="text-xs mt-2 px-2 py-0.5 rounded"
            style={{ color: 'var(--accent)', background: 'none', border: '1px dashed var(--border)', cursor: 'pointer', width: '100%' }}
            onClick={addRootNode}
          >
            + ノード追加
          </button>
        )}
      </div>
    </div>
  );
}

function NodeList({
  nodes, depth, onAddChild, onRemove, onUpdate,
}: {
  nodes: PlotNode[];
  depth: number;
  onAddChild: (parentId: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: 'label' | 'content', value: string) => void;
}) {
  return (
    <div style={{ paddingLeft: depth > 0 ? '12px' : '0', borderLeft: depth > 0 ? '1px solid var(--border)' : 'none' }}>
      {nodes.map((node) => (
        <NodeItem key={node.id} node={node} depth={depth} onAddChild={onAddChild} onRemove={onRemove} onUpdate={onUpdate} />
      ))}
    </div>
  );
}

function NodeItem({
  node, depth, onAddChild, onRemove, onUpdate,
}: {
  node: PlotNode;
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
          minHeight: '70px',
          maxHeight: '400px',
          marginLeft: '14px',
          width: 'calc(100% - 14px)',
        }}
        value={node.content}
        onChange={(e) => onUpdate(node.id, 'content', e.target.value)}
        placeholder="内容..."
        rows={1}
      />
      {expanded && node.children.length > 0 && (
        <NodeList nodes={node.children} depth={depth + 1} onAddChild={onAddChild} onRemove={onRemove} onUpdate={onUpdate} />
      )}
    </div>
  );
}

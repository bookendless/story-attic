/**
 * プロットツリー — プロット一覧 + ノードツリービュー
 *
 * プロット選択 → ノードの追加・削除・編集。
 * プロットタイプ選択で初期ノード構造を自動生成。
 */

import { useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Plot, PlotData, PlotNode } from '@/shared/types';
import { DEFAULT_PLOT_DATA, PLOT_TYPE_PRESETS } from '@/shared/types';

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

export function PlotTree({ projectId, plots, onReload }: PlotTreeProps) {
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [editingNodes, setEditingNodes] = useState<PlotNode[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedPlot = plots.find((p) => p.id === selectedPlotId) ?? null;

  const selectPlot = (plot: Plot) => {
    setSelectedPlotId(plot.id);
    setEditingNodes(parseData(plot.data).nodes);
  };

  const handleCreate = useCallback(async (plotType: string) => {
    try {
      await invoke<string>('create_plot', {
        projectId,
        title: `新しいプロット (${plotType})`,
        plotType,
      });
      onReload();
    } catch { /* 無視 */ }
  }, [projectId, onReload]);

  const handleDeletePlot = useCallback(async (id: string) => {
    try {
      await invoke('delete_plot', { id });
      if (selectedPlotId === id) {
        setSelectedPlotId(null);
        setEditingNodes([]);
      }
      onReload();
    } catch { /* 無視 */ }
  }, [selectedPlotId, onReload]);

  // ノード変更を自動保存
  const saveNodes = useCallback((nodes: PlotNode[]) => {
    if (!selectedPlot) return;
    setEditingNodes(nodes);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await invoke('update_plot', {
          id: selectedPlot.id,
          title: selectedPlot.title,
          plotType: selectedPlot.plotType,
          theme: selectedPlot.theme,
          data: JSON.stringify({ nodes }),
        });
        onReload();
      } catch { /* 無視 */ }
    }, 500);
  }, [selectedPlot, onReload]);

  const addRootNode = () => {
    const node: PlotNode = { id: newNodeId(), label: '新しいノード', content: '', children: [] };
    saveNodes([...editingNodes, node]);
  };

  // ノードにサブノードを追加（再帰）
  const addChildNode = (nodes: PlotNode[], parentId: string): PlotNode[] => {
    return nodes.map((n) => {
      if (n.id === parentId) {
        return { ...n, children: [...n.children, { id: newNodeId(), label: '新しいノード', content: '', children: [] }] };
      }
      return { ...n, children: addChildNode(n.children, parentId) };
    });
  };

  // ノード削除（再帰）
  const removeNode = (nodes: PlotNode[], targetId: string): PlotNode[] => {
    return nodes
      .filter((n) => n.id !== targetId)
      .map((n) => ({ ...n, children: removeNode(n.children, targetId) }));
  };

  // ノードのラベル・内容更新（再帰）
  const updateNode = (nodes: PlotNode[], targetId: string, field: 'label' | 'content', value: string): PlotNode[] => {
    return nodes.map((n) => {
      if (n.id === targetId) return { ...n, [field]: value };
      return { ...n, children: updateNode(n.children, targetId, field, value) };
    });
  };

  // プロット一覧（未選択時）
  if (!selectedPlot) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>プロット ({plots.length})</span>
        </div>
        {/* 新規作成ボタン群 */}
        <div className="px-3 py-2 flex flex-wrap gap-1" style={{ borderBottom: '1px solid var(--border)' }}>
          {Object.keys(PLOT_TYPE_PRESETS).map((t) => (
            <button
              key={t}
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}
              onClick={() => handleCreate(t)}
            >
              + {t}
            </button>
          ))}
        </div>
        {plots.length === 0 && (
          <div className="px-3 py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            プロットがありません
          </div>
        )}
        {plots.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between px-3 py-1.5 cursor-pointer"
            style={{ borderBottom: '1px solid var(--border)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            onClick={() => selectPlot(p)}
          >
            <div className="flex flex-col min-w-0">
              <span className="text-xs truncate" style={{ color: 'var(--text)' }}>{p.title}</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.plotType}</span>
            </div>
            <button
              className="text-xs flex-shrink-0"
              style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
              onClick={(e) => { e.stopPropagation(); handleDeletePlot(p.id); }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    );
  }

  // ツリー編集ビュー（選択時）
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <button
          className="text-xs"
          style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={() => { setSelectedPlotId(null); setEditingNodes([]); }}
        >
          ←
        </button>
        <span className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>
          {selectedPlot.title}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({selectedPlot.plotType})</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {editingNodes.length === 0 && (
          <div className="text-center py-4">
            <button
              className="text-xs px-3 py-1 rounded"
              style={{ background: 'var(--accent)', color: 'var(--bg-deep)', border: 'none', cursor: 'pointer' }}
              onClick={() => {
                // プリセットからノード生成
                const preset = PLOT_TYPE_PRESETS[selectedPlot.plotType] ?? [];
                if (preset.length > 0) {
                  const nodes = preset.map((label) => ({ id: newNodeId(), label, content: '', children: [] }));
                  saveNodes(nodes);
                } else {
                  addRootNode();
                }
              }}
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

/** ノードリスト（再帰） */
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

/** 個々のノード */
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
        {node.children.length > 0 && (
          <button
            className="text-xs flex-shrink-0"
            style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', width: '14px' }}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? '▼' : '▶'}
          </button>
        )}
        {node.children.length === 0 && <span style={{ width: '14px', display: 'inline-block' }} />}
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
        className="w-full text-xs bg-transparent outline-none resize-none mt-0.5"
        style={{
          color: 'var(--text-mid)',
          border: '1px solid var(--border)',
          borderRadius: '3px',
          padding: '3px 5px',
          minHeight: '28px',
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

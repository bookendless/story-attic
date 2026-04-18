/**
 * 相関図詳細・編集ビュー — タイトルとノード／エッジ一覧を編集する。
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type {
  Correlation,
  CorrelationData,
  CorrelationNode,
  CorrelationEdge,
} from '@/shared/types';
import {
  RELATIONSHIP_TYPES,
  RELATIONSHIP_TYPE_LABELS,
  RELATIONSHIP_TYPE_COLORS,
} from '@/shared/constants/asbEnums';
import type { RelationshipType } from '@/shared/constants/asbEnums';

interface Props {
  item: Correlation;
  onBack: () => void;
  onUpdate: () => void | Promise<void>;
  onOpenDiagram: () => void;
}

export function RelationshipDetail({ item, onBack, onUpdate, onOpenDiagram }: Props) {
  const [title, setTitle] = useState(item.title);
  const [data, setData] = useState<CorrelationData>(() => safeParse(item.data));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setTitle(item.title);
    setData(safeParse(item.data));
    setDirty(false);
  }, [item.id, item.title, item.data]);

  const handleSave = useCallback(async () => {
    try {
      await invoke('update_correlation', {
        id: item.id,
        title,
        data: JSON.stringify(data),
      });
      setDirty(false);
      await onUpdate();
    } catch { /* 無視 */ }
  }, [item.id, title, data, onUpdate]);

  const addNode = () => {
    const id = crypto.randomUUID();
    setData((prev) => ({
      ...prev,
      nodes: [...prev.nodes, { id, name: '新規ノード', characterId: '' }],
    }));
    setDirty(true);
  };

  const updateNode = (idx: number, patch: Partial<CorrelationNode>) => {
    setData((prev) => {
      const nodes = [...prev.nodes];
      nodes[idx] = { ...nodes[idx], ...patch };
      return { ...prev, nodes };
    });
    setDirty(true);
  };

  const removeNode = (idx: number) => {
    setData((prev) => {
      const nodeId = prev.nodes[idx].id;
      return {
        nodes: prev.nodes.filter((_, i) => i !== idx),
        edges: prev.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
      };
    });
    setDirty(true);
  };

  const addEdge = () => {
    const first = data.nodes[0]?.id ?? '';
    const second = data.nodes[1]?.id ?? first;
    setData((prev) => ({
      ...prev,
      edges: [
        ...prev.edges,
        { from: first, to: second, type: 'friend', intensity: 5, description: '', notes: '' },
      ],
    }));
    setDirty(true);
  };

  const updateEdge = (idx: number, patch: Partial<CorrelationEdge>) => {
    setData((prev) => {
      const edges = [...prev.edges];
      edges[idx] = { ...edges[idx], ...patch };
      return { ...prev, edges };
    });
    setDirty(true);
  };

  const removeEdge = (idx: number) => {
    setData((prev) => ({ ...prev, edges: prev.edges.filter((_, i) => i !== idx) }));
    setDirty(true);
  };

  const nodeName = (id: string) => data.nodes.find((n) => n.id === id)?.name ?? id;

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <button
          onClick={onBack}
          className="text-xs"
          style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}
        >
          ← 戻る
        </button>
        <div className="flex-1" />
        <button
          onClick={onOpenDiagram}
          className="text-xs px-2 py-1 rounded"
          style={{
            background: 'transparent',
            color: 'var(--accent)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
          }}
        >
          図を表示
        </button>
        <button
          onClick={handleSave}
          disabled={!dirty}
          className="text-xs px-2 py-1 rounded"
          style={{
            background: dirty ? 'var(--accent)' : 'transparent',
            color: dirty ? '#fff' : 'var(--text-muted)',
            border: '1px solid var(--border)',
            cursor: dirty ? 'pointer' : 'default',
          }}
        >
          保存
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        <Field label="タイトル">
          <input
            className="w-full text-sm px-2 py-1 rounded"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            value={title}
            onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
          />
        </Field>

        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              ノード（{data.nodes.length}）
            </div>
            <button
              onClick={addNode}
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}
            >
              ＋ノード
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {data.nodes.map((n, i) => (
              <div key={n.id} className="flex items-center gap-1">
                <input
                  className="flex-1 text-xs px-2 py-1 rounded"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  value={n.name}
                  onChange={(e) => updateNode(i, { name: e.target.value })}
                />
                <button
                  onClick={() => removeNode(i)}
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
                  title="削除"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              関係（{data.edges.length}）
            </div>
            <button
              onClick={addEdge}
              disabled={data.nodes.length < 2}
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                background: 'var(--bg-elevated)',
                color: data.nodes.length < 2 ? 'var(--text-muted)' : 'var(--text-secondary)',
                border: '1px solid var(--border)',
                cursor: data.nodes.length < 2 ? 'default' : 'pointer',
              }}
            >
              ＋関係
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {data.edges.map((e, i) => {
              const color = RELATIONSHIP_TYPE_COLORS[e.type as RelationshipType] ?? '#6b7280';
              return (
                <div
                  key={i}
                  className="flex flex-col gap-1 p-2 rounded"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderLeft: `3px solid ${color}` }}
                >
                  <div className="flex items-center gap-1">
                    <select
                      className="flex-1 text-xs px-1 py-0.5 rounded outline-none"
                      style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      value={e.from}
                      onChange={(ev) => updateEdge(i, { from: ev.target.value })}
                    >
                      {data.nodes.map((n) => (
                        <option key={n.id} value={n.id}>{n.name}</option>
                      ))}
                    </select>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>→</span>
                    <select
                      className="flex-1 text-xs px-1 py-0.5 rounded outline-none"
                      style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      value={e.to}
                      onChange={(ev) => updateEdge(i, { to: ev.target.value })}
                    >
                      {data.nodes.map((n) => (
                        <option key={n.id} value={n.id}>{n.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeEdge(i)}
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <select
                      className="text-xs px-1 py-0.5 rounded outline-none"
                      style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      value={e.type}
                      onChange={(ev) => updateEdge(i, { type: ev.target.value })}
                    >
                      {RELATIONSHIP_TYPES.map((t) => (
                        <option key={t} value={t}>{RELATIONSHIP_TYPE_LABELS[t]}</option>
                      ))}
                      {e.type && !RELATIONSHIP_TYPES.includes(e.type as RelationshipType) && (
                        <option value={e.type}>{e.type} (既存)</option>
                      )}
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      className="w-14 text-xs px-1 py-0.5 rounded"
                      style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      value={e.intensity}
                      onChange={(ev) => updateEdge(i, { intensity: Number(ev.target.value) || 0 })}
                      title="強度(1-10)"
                    />
                    <input
                      className="flex-1 text-xs px-1 py-0.5 rounded"
                      style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      placeholder="説明"
                      value={e.description}
                      onChange={(ev) => updateEdge(i, { description: ev.target.value })}
                    />
                  </div>
                  {!data.nodes.some((n) => n.id === e.from) || !data.nodes.some((n) => n.id === e.to) ? (
                    <div className="text-xs" style={{ color: '#ef4444' }}>
                      参照切れ: {nodeName(e.from)} / {nodeName(e.to)}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs mb-1 font-medium" style={{ color: 'var(--text-muted)' }}>{label}</div>
      {children}
    </div>
  );
}

function safeParse(json: string): CorrelationData {
  try {
    const parsed = JSON.parse(json || '{}');
    return {
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
    };
  } catch {
    return { nodes: [], edges: [] };
  }
}

/**
 * 相関図パネル — 右パネル「相関図」タブ。
 * correlations テーブルの一覧表示＋詳細編集＋SVG モーダルプレビュー。
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import { useAppStore } from '@/shared/stores/appStore';
import type { Correlation, CorrelationData } from '@/shared/types';
import { RelationshipDetail } from './RelationshipDetail';
import { RelationshipDiagramModal } from './RelationshipDiagramModal';

const EMPTY_DATA: CorrelationData = { nodes: [], edges: [] };

export function RelationshipPanel() {
  const projectId = useAppStore((s) => s.currentProjectId);
  const [items, setItems] = useState<Correlation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [diagramId, setDiagramId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    if (!projectId) return;
    try {
      const raw = await invoke<unknown[]>('get_correlations', { projectId });
      setItems(toCamelCase<Correlation[]>(raw));
    } catch { /* 無視 */ }
  }, [projectId]);

  useEffect(() => { void loadItems(); }, [loadItems]);

  const handleCreate = useCallback(async () => {
    if (!projectId) return;
    try {
      const id = await invoke<string>('create_correlation', {
        projectId,
        title: '新しい相関図',
        data: JSON.stringify(EMPTY_DATA),
      });
      await loadItems();
      setSelectedId(id);
    } catch { /* 無視 */ }
  }, [projectId, loadItems]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await invoke('delete_correlation', { id });
      if (selectedId === id) setSelectedId(null);
      if (diagramId === id) setDiagramId(null);
      await loadItems();
    } catch { /* 無視 */ }
  }, [selectedId, diagramId, loadItems]);

  if (!projectId) return null;

  const selected = items.find((i) => i.id === selectedId);
  if (selected) {
    return (
      <>
        <RelationshipDetail
          item={selected}
          onBack={() => setSelectedId(null)}
          onUpdate={loadItems}
          onOpenDiagram={() => setDiagramId(selected.id)}
        />
        {diagramId === selected.id && (
          <RelationshipDiagramModal
            item={selected}
            onClose={() => setDiagramId(null)}
          />
        )}
      </>
    );
  }

  const diagramItem = items.find((i) => i.id === diagramId);

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          相関図（{items.length}件）
        </span>
        <button
          onClick={handleCreate}
          className="text-xs px-2 py-1 rounded"
          style={{
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          ＋追加
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div
            className="flex items-center justify-center h-full text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            相関図がありません
          </div>
        ) : (
          items.map((item) => {
            const data = safeParse(item.data);
            return (
              <div
                key={item.id}
                className="px-3 py-2 cursor-pointer"
                style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0" onClick={() => setSelectedId(item.id)}>
                    <div
                      className="text-sm truncate font-medium"
                      style={{ color: 'var(--text)' }}
                    >
                      {item.title || '（タイトルなし）'}
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      ノード {data.nodes.length} / エッジ {data.edges.length}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => setDiagramId(item.id)}
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        color: 'var(--accent)',
                        border: '1px solid var(--border)',
                        background: 'transparent',
                        cursor: 'pointer',
                      }}
                      title="図を表示"
                    >
                      図
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        color: 'var(--text-muted)',
                        border: '1px solid var(--border)',
                        background: 'transparent',
                        cursor: 'pointer',
                      }}
                      title="削除"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {diagramItem && (
        <RelationshipDiagramModal
          item={diagramItem}
          onClose={() => setDiagramId(null)}
        />
      )}
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

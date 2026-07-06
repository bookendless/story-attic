/**
 * 伏線トラッカーパネル — 右パネル内の「伏線」タブ
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import { useAppStore } from '@/shared/stores/appStore';
import type { PlotThread, PlotThreadData } from '@/shared/types';
import { DEFAULT_PLOT_THREAD_DATA } from '@/shared/types';
import { PlotThreadDetail } from './PlotThreadDetail';
import {
  FORESHADOWING_STATUS_LABELS,
  FORESHADOWING_IMPORTANCE_LABELS,
  FORESHADOWING_CATEGORY_LABELS,
} from '@/shared/constants/asbEnums';
import type {
  ForeshadowingStatus,
  ForeshadowingImportance,
  ForeshadowingCategory,
} from '@/shared/constants/asbEnums';

const STATUS_BADGE: Record<ForeshadowingStatus, { bg: string; color: string }> = {
  planted:   { bg: '#fef3c7', color: '#92400e' },
  hinted:    { bg: '#dbeafe', color: '#1e40af' },
  resolved:  { bg: '#d1fae5', color: '#065f46' },
  abandoned: { bg: '#f3f4f6', color: '#4b5563' },
};

const IMPORTANCE_BADGE: Record<ForeshadowingImportance, { bg: string; color: string }> = {
  high:   { bg: '#fee2e2', color: '#991b1b' },
  medium: { bg: '#fef3c7', color: '#92400e' },
  low:    { bg: '#f3f4f6', color: '#4b5563' },
};

export function PlotThreadPanel() {
  const projectId = useAppStore((s) => s.currentProjectId);
  const [items, setItems] = useState<PlotThread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    if (!projectId) return;
    try {
      const raw = await invoke<unknown[]>('get_plot_threads', { projectId });
      setItems(toCamelCase<PlotThread[]>(raw));
    } catch { /* 無視 */ }
  }, [projectId]);

  useEffect(() => { void loadItems(); }, [loadItems]);

  const handleCreate = useCallback(async () => {
    if (!projectId) return;
    try {
      const id = await invoke<string>('create_plot_thread', {
        projectId,
        title: '新しい伏線',
        category: '',
        data: JSON.stringify(DEFAULT_PLOT_THREAD_DATA),
      });
      await loadItems();
      setSelectedId(id);
    } catch { /* 無視 */ }
  }, [projectId, loadItems]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await invoke('delete_plot_thread', { id });
      if (selectedId === id) setSelectedId(null);
      await loadItems();
    } catch { /* 無視 */ }
  }, [selectedId, loadItems]);

  const selected = items.find((i) => i.id === selectedId) ?? null;
  if (!projectId) return null;

  if (selected) {
    return (
      <PlotThreadDetail
        item={selected}
        onBack={() => setSelectedId(null)}
        onUpdate={loadItems}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダ */}
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          伏線トラッカー（{items.length}件）
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

      {/* リスト */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div
            className="flex items-center justify-center h-full text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            伏線がありません
          </div>
        ) : (
          items.map((item) => {
            const data: PlotThreadData = JSON.parse(item.data || '{}');
            return (
              <div
                key={item.id}
                className="px-3 py-2 cursor-pointer"
                style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className="flex-1 min-w-0"
                    onClick={() => setSelectedId(item.id)}
                  >
                    <div
                      className="text-sm truncate font-medium"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {item.title || '（タイトルなし）'}
                    </div>
                    <div className="text-xs mt-1 flex gap-1 flex-wrap items-center">
                      {item.category && (
                        <span style={{ color: 'var(--text-muted)' }}>
                          {FORESHADOWING_CATEGORY_LABELS[item.category as ForeshadowingCategory] ?? item.category}
                        </span>
                      )}
                      {data.status && (
                        <Badge
                          label={FORESHADOWING_STATUS_LABELS[data.status as ForeshadowingStatus] ?? data.status}
                          palette={STATUS_BADGE[data.status as ForeshadowingStatus]}
                        />
                      )}
                      {data.importance && (
                        <Badge
                          label={FORESHADOWING_IMPORTANCE_LABELS[data.importance as ForeshadowingImportance] ?? data.importance}
                          palette={IMPORTANCE_BADGE[data.importance as ForeshadowingImportance]}
                        />
                      )}
                    </div>
                    {data.description && (
                      <div
                        className="text-xs mt-1 line-clamp-2"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {data.description}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-xs flex-shrink-0 px-1.5 py-0.5 rounded"
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
            );
          })
        )}
      </div>
    </div>
  );
}

function Badge({ label, palette }: { label: string; palette?: { bg: string; color: string } }) {
  return (
    <span
      className="rounded px-1.5 py-0.5"
      style={{
        background: palette?.bg ?? 'var(--bg-elevated)',
        color: palette?.color ?? 'var(--text-muted)',
        fontSize: '10px',
        fontWeight: 500,
      }}
    >
      {label}
    </span>
  );
}

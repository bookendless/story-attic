/**
 * 世界観パネル — 右パネル「世界観」タブ。
 * materials テーブル book='世界観設定' 行をカテゴリ別に表示し、詳細編集を行う。
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import { useAppStore } from '@/shared/stores/appStore';
import type { Material, MaterialData } from '@/shared/types';
import { WORLD_CATEGORIES, WORLD_CATEGORY_LABELS } from '@/shared/constants/asbEnums';
import type { WorldCategory } from '@/shared/constants/asbEnums';
import { WorldSettingDetail } from './WorldSettingDetail';

const WORLD_BOOK = '世界観設定';

export function WorldSettingPanel() {
  const projectId = useAppStore((s) => s.currentProjectId);
  const [items, setItems] = useState<Material[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    if (!projectId) return;
    try {
      const raw = await invoke<unknown[]>('get_materials', { projectId });
      const all = toCamelCase<Material[]>(raw);
      setItems(all.filter((m) => m.book === WORLD_BOOK));
    } catch { /* 無視 */ }
  }, [projectId]);

  useEffect(() => { void loadItems(); }, [loadItems]);

  const handleCreate = useCallback(async () => {
    if (!projectId) return;
    try {
      const id = await invoke<string>('create_material', {
        projectId,
        title: '新しい世界観設定',
        book: WORLD_BOOK,
        category: 'geography',
      });
      await loadItems();
      setSelectedId(id);
    } catch { /* 無視 */ }
  }, [projectId, loadItems]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await invoke('delete_material', { id });
      if (selectedId === id) setSelectedId(null);
      await loadItems();
    } catch { /* 無視 */ }
  }, [selectedId, loadItems]);

  const grouped = useMemo(() => {
    const map = new Map<string, Material[]>();
    for (const item of items) {
      const key = item.category || 'other';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [items]);

  const orderedCategories = useMemo(() => {
    const keys = Array.from(grouped.keys());
    return keys.sort((a, b) => {
      const ai = WORLD_CATEGORIES.indexOf(a as WorldCategory);
      const bi = WORLD_CATEGORIES.indexOf(b as WorldCategory);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [grouped]);

  if (!projectId) return null;

  const selected = items.find((i) => i.id === selectedId);
  if (selected) {
    return (
      <WorldSettingDetail
        item={selected}
        onBack={() => setSelectedId(null)}
        onUpdate={loadItems}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          世界観設定（{items.length}件）
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
            世界観設定がありません
          </div>
        ) : (
          orderedCategories.map((cat) => {
            const label = WORLD_CATEGORY_LABELS[cat as WorldCategory] ?? cat;
            const list = grouped.get(cat) ?? [];
            return (
              <div key={cat}>
                <div
                  className="text-xs font-semibold px-3 py-1 sticky top-0 z-10"
                  style={{
                    color: 'var(--text-muted)',
                    background: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  {label} ({list.length})
                </div>
                {list.map((item) => {
                  const data: MaterialData = safeParse(item.data);
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
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {item.title || '（タイトルなし）'}
                          </div>
                          {data.content && (
                            <div
                              className="text-xs mt-1 line-clamp-2"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {data.content}
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
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function safeParse(json: string): MaterialData {
  try {
    const parsed = JSON.parse(json || '{}');
    return {
      content: parsed.content ?? '',
      source: parsed.source ?? '',
      url: parsed.url ?? '',
    };
  } catch {
    return { content: '', source: '', url: '' };
  }
}

/**
 * 伏線詳細・編集ビュー
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { PlotThread, PlotThreadData } from '@/shared/types';

interface Props {
  item: PlotThread;
  onBack: () => void;
  onUpdate: () => void;
}

export function PlotThreadDetail({ item, onBack, onUpdate }: Props) {
  const [title, setTitle] = useState(item.title);
  const [category, setCategory] = useState(item.category);
  const [data, setData] = useState<PlotThreadData>(() => {
    try { return JSON.parse(item.data); } catch { return {} as PlotThreadData; }
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setTitle(item.title);
    setCategory(item.category);
    try { setData(JSON.parse(item.data)); } catch { /* 無視 */ }
    setDirty(false);
  }, [item.id, item.title, item.category, item.data]);

  const handleSave = useCallback(async () => {
    try {
      await invoke('update_plot_thread', {
        id: item.id,
        title,
        category,
        data: JSON.stringify(data),
      });
      setDirty(false);
      onUpdate();
    } catch { /* 無視 */ }
  }, [item.id, title, category, data, onUpdate]);

  const updateData = (key: keyof PlotThreadData, value: unknown) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダ */}
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

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        <Field label="タイトル">
          <input
            className="w-full text-sm px-2 py-1 rounded"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            value={title}
            onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
          />
        </Field>

        <div className="flex gap-2">
          <Field label="カテゴリ" className="flex-1">
            <input
              className="w-full text-sm px-2 py-1 rounded"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              value={category}
              onChange={(e) => { setCategory(e.target.value); setDirty(true); }}
            />
          </Field>
          <Field label="ステータス" className="flex-1">
            <input
              className="w-full text-sm px-2 py-1 rounded"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              value={data.status ?? ''}
              onChange={(e) => updateData('status', e.target.value)}
            />
          </Field>
          <Field label="重要度" className="flex-1">
            <input
              className="w-full text-sm px-2 py-1 rounded"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              value={data.importance ?? ''}
              onChange={(e) => updateData('importance', e.target.value)}
            />
          </Field>
        </div>

        <Field label="説明">
          <textarea
            rows={3}
            className="w-full text-sm px-2 py-1 rounded resize-none"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            value={data.description ?? ''}
            onChange={(e) => updateData('description', e.target.value)}
          />
        </Field>

        <Field label="関連キャラクター">
          <input
            className="w-full text-sm px-2 py-1 rounded"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            placeholder="カンマ区切りで入力"
            value={(data.relatedCharacters ?? []).join(', ')}
            onChange={(e) => updateData('relatedCharacters', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
          />
        </Field>

        <Field label="回収予定方法">
          <textarea
            rows={2}
            className="w-full text-sm px-2 py-1 rounded resize-none"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            value={data.resolution ?? ''}
            onChange={(e) => updateData('resolution', e.target.value)}
          />
        </Field>

        {data.recommendedPlacement && (
          <Field label="設置推奨">
            <div className="text-xs px-2 py-1 rounded" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
              {data.recommendedPlacement}
            </div>
          </Field>
        )}

        {data.expectedEffect && (
          <Field label="期待効果">
            <div className="text-xs px-2 py-1 rounded" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
              {data.expectedEffect}
            </div>
          </Field>
        )}

        <Field label="メモ">
          <textarea
            rows={2}
            className="w-full text-sm px-2 py-1 rounded resize-none"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            value={data.notes ?? ''}
            onChange={(e) => updateData('notes', e.target.value)}
          />
        </Field>

        {/* ポイント一覧 */}
        {(data.points ?? []).length > 0 && (
          <div>
            <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>ポイント</div>
            {data.points.map((p, i) => (
              <div
                key={i}
                className="text-xs px-2 py-1 rounded mb-1"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
              >
                <span style={{ color: 'var(--accent)' }}>{p.type}</span>
                {p.chapter && <span style={{ color: 'var(--text-muted)' }}> {p.chapter}</span>}
                {p.content && <span> — {p.content}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs mb-1 font-medium" style={{ color: 'var(--text-muted)' }}>{label}</div>
      {children}
    </div>
  );
}

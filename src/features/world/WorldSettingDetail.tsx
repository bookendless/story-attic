/**
 * 世界観設定詳細・編集ビュー。
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Material, MaterialData } from '@/shared/types';
import {
  WORLD_CATEGORIES,
  WORLD_CATEGORY_LABELS,
} from '@/shared/constants/asbEnums';
import type { WorldCategory } from '@/shared/constants/asbEnums';

interface Props {
  item: Material;
  onBack: () => void;
  onUpdate: () => void | Promise<void>;
}

const WORLD_BOOK = '世界観設定';

export function WorldSettingDetail({ item, onBack, onUpdate }: Props) {
  const [title, setTitle] = useState(item.title);
  const [category, setCategory] = useState(item.category);
  const [data, setData] = useState<MaterialData>(() => safeParse(item.data));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setTitle(item.title);
    setCategory(item.category);
    setData(safeParse(item.data));
    setDirty(false);
  }, [item.id, item.title, item.category, item.data]);

  const handleSave = useCallback(async () => {
    try {
      await invoke('update_material', {
        id: item.id,
        title,
        book: WORLD_BOOK,
        category,
        data: JSON.stringify(data),
      });
      setDirty(false);
      await onUpdate();
    } catch { /* 無視 */ }
  }, [item.id, title, category, data, onUpdate]);

  const updateData = (key: keyof MaterialData, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

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

        <Field label="カテゴリ">
          <select
            className="w-full text-sm px-2 py-1 rounded outline-none input"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            value={category}
            onChange={(e) => { setCategory(e.target.value); setDirty(true); }}
          >
            <option value="">(未設定)</option>
            {WORLD_CATEGORIES.map((c) => (
              <option key={c} value={c}>{WORLD_CATEGORY_LABELS[c]}</option>
            ))}
            {category && !WORLD_CATEGORIES.includes(category as WorldCategory) && (
              <option value={category}>{category} (既存)</option>
            )}
          </select>
        </Field>

        <Field label="内容">
          <textarea
            rows={10}
            className="w-full text-sm px-2 py-1 rounded resize-none"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            value={data.content}
            onChange={(e) => updateData('content', e.target.value)}
          />
        </Field>

        <div className="flex gap-2">
          <Field label="出典" className="flex-1">
            <input
              className="w-full text-sm px-2 py-1 rounded"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              value={data.source}
              onChange={(e) => updateData('source', e.target.value)}
            />
          </Field>
          <Field label="URL" className="flex-1">
            <input
              className="w-full text-sm px-2 py-1 rounded"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              value={data.url}
              onChange={(e) => updateData('url', e.target.value)}
            />
          </Field>
        </div>
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

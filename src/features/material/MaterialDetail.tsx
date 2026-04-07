/**
 * 資料詳細 — タイトル・ブック・カテゴリ・内容・出典・URL・タグ
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Material, MaterialData, Tag } from '@/shared/types';
import { DEFAULT_MATERIAL_DATA } from '@/shared/types';
import { TagPicker } from '@/shared/components/TagPicker';

interface MaterialDetailProps {
  item: Material;
  tags: Tag[];
  projectId: string;
  onBack: () => void;
  onUpdate: () => void;
  onTagsChange: () => void;
}

function parseData(raw: string): MaterialData {
  try {
    return { ...DEFAULT_MATERIAL_DATA, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_MATERIAL_DATA };
  }
}

export function MaterialDetail({ item, tags, projectId, onBack, onUpdate, onTagsChange }: MaterialDetailProps) {
  const [title, setTitle] = useState(item.title);
  const [book, setBook] = useState(item.book);
  const [category, setCategory] = useState(item.category);
  const [data, setData] = useState<MaterialData>(() => parseData(item.data));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTitle(item.title);
    setBook(item.book);
    setCategory(item.category);
    setData(parseData(item.data));
  }, [item.id, item.title, item.book, item.category, item.data]);

  const save = useCallback(
    (t: string, b: string, c: string, d: MaterialData) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await invoke('update_material', { id: item.id, title: t, book: b, category: c, data: JSON.stringify(d) });
          onUpdate();
        } catch { /* 無視 */ }
      }, 500);
    },
    [item.id, onUpdate],
  );

  const updateData = (field: keyof MaterialData, value: string) => {
    const newData = { ...data, [field]: value };
    setData(newData);
    save(title, book, category, newData);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <button className="text-xs" style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }} onClick={onBack}>←</button>
        <input
          className="flex-1 text-sm font-medium bg-transparent outline-none"
          style={{ color: 'var(--text)', border: 'none' }}
          value={title}
          onChange={(e) => { setTitle(e.target.value); save(e.target.value, book, category, data); }}
          placeholder="資料名"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2">
        <Field label="ブック">
          <input
            className="w-full text-xs bg-transparent outline-none"
            style={{ color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px' }}
            value={book}
            onChange={(e) => { setBook(e.target.value); save(title, e.target.value, category, data); }}
            placeholder="書籍・資料集など"
          />
        </Field>
        <Field label="カテゴリ">
          <input
            className="w-full text-xs bg-transparent outline-none"
            style={{ color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px' }}
            value={category}
            onChange={(e) => { setCategory(e.target.value); save(title, book, e.target.value, data); }}
            placeholder="分類"
          />
        </Field>
        <Field label="内容">
          <textarea
            className="w-full text-xs bg-transparent outline-none resize-none"
            style={{ color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '6px', minHeight: '100px' }}
            value={data.content}
            onChange={(e) => updateData('content', e.target.value)}
            placeholder="資料の内容..."
          />
        </Field>
        <Field label="出典">
          <input
            className="w-full text-xs bg-transparent outline-none"
            style={{ color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px' }}
            value={data.source}
            onChange={(e) => updateData('source', e.target.value)}
            placeholder="出典元"
          />
        </Field>
        <Field label="URL">
          <input
            className="w-full text-xs bg-transparent outline-none"
            style={{ color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px' }}
            value={data.url}
            onChange={(e) => updateData('url', e.target.value)}
            placeholder="https://..."
          />
        </Field>
        <div>
          <span className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>タグ</span>
          <TagPicker projectId={projectId} entityType="material" entityId={item.id} tags={tags} onTagsChange={onTagsChange} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</span>
      {children}
    </div>
  );
}

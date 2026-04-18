/**
 * 用語詳細 — 読み・説明・関連情報・タグ
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { GlossaryItem, GlossaryData, Tag } from '@/shared/types';
import { DEFAULT_GLOSSARY_DATA } from '@/shared/types';
import { TagPicker } from '@/shared/components/TagPicker';
import {
  GLOSSARY_CATEGORIES,
  GLOSSARY_CATEGORY_LABELS,
} from '@/shared/constants/asbEnums';

interface GlossaryDetailProps {
  item: GlossaryItem;
  tags: Tag[];
  projectId: string;
  onBack: () => void;
  onUpdate: () => void;
  onTagsChange: () => void;
}

function parseData(raw: string): GlossaryData {
  try {
    return { ...DEFAULT_GLOSSARY_DATA, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_GLOSSARY_DATA };
  }
}

export function GlossaryDetail({ item, tags, projectId, onBack, onUpdate, onTagsChange }: GlossaryDetailProps) {
  const [term, setTerm] = useState(item.term);
  const [category, setCategory] = useState(item.category);
  const [data, setData] = useState<GlossaryData>(() => parseData(item.data));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTerm(item.term);
    setCategory(item.category);
    setData(parseData(item.data));
  }, [item.id, item.term, item.category, item.data]);

  const save = useCallback(
    (t: string, c: string, d: GlossaryData) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await invoke('update_glossary', { id: item.id, term: t, category: c, data: JSON.stringify(d) });
          onUpdate();
        } catch { /* 無視 */ }
      }, 500);
    },
    [item.id, onUpdate],
  );

  const update = (field: keyof GlossaryData, value: string) => {
    const newData = { ...data, [field]: value };
    setData(newData);
    save(term, category, newData);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <button className="text-xs" style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }} onClick={onBack}>←</button>
        <input
          className="flex-1 text-sm font-medium bg-transparent outline-none"
          style={{ color: 'var(--text)', border: 'none' }}
          value={term}
          onChange={(e) => { setTerm(e.target.value); save(e.target.value, category, data); }}
          placeholder="用語名"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2">
        <Field label="カテゴリ">
          <select
            className="w-full text-xs outline-none"
            style={{
              color: 'var(--text)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '3px 6px',
            }}
            value={category}
            onChange={(e) => { setCategory(e.target.value); save(term, e.target.value, data); }}
          >
            <option value="">(未分類)</option>
            {GLOSSARY_CATEGORIES.map((c) => (
              <option key={c} value={c}>{GLOSSARY_CATEGORY_LABELS[c]}</option>
            ))}
            {category && !GLOSSARY_CATEGORIES.includes(category as never) && (
              <option value={category}>{category} (既存)</option>
            )}
          </select>
        </Field>
        <Field label="読み">
          <input
            className="w-full text-xs bg-transparent outline-none"
            style={{ color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px' }}
            value={data.reading}
            onChange={(e) => update('reading', e.target.value)}
            placeholder="ふりがな"
          />
        </Field>
        <Field label="説明">
          <textarea
            className="w-full text-xs bg-transparent outline-none resize-none"
            style={{ color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 6px', minHeight: '80px' }}
            value={data.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="用語の説明..."
          />
        </Field>
        <Field label="関連情報">
          <textarea
            className="w-full text-xs bg-transparent outline-none resize-none"
            style={{ color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 6px', minHeight: '48px' }}
            value={data.related}
            onChange={(e) => update('related', e.target.value)}
            placeholder="関連する用語や情報..."
          />
        </Field>
        <div>
          <span className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>タグ</span>
          <TagPicker projectId={projectId} entityType="glossary" entityId={item.id} tags={tags} onTagsChange={onTagsChange} />
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

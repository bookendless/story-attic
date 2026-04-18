/**
 * キャラクター詳細 — ASB 準拠プロフィール + 詳細折り畳み
 *
 * 主表示: 外見 / 性格 / 背景 (ASB Character 準拠)
 * 折り畳み「詳細」: 性別 / 年齢 / 職業 / 追加フィールド / カスタムタブ
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type {
  Character,
  CharacterData,
  CharacterProfile,
  CharacterTab,
  CharacterExtraField,
  Tag,
} from '@/shared/types';
import { DEFAULT_CHARACTER_DATA } from '@/shared/types';
import { TagPicker } from '@/shared/components/TagPicker';

interface CharacterDetailProps {
  character: Character;
  tags: Tag[];
  projectId: string;
  onBack: () => void;
  onUpdate: () => void;
  onTagsChange: () => void;
}

// ASB Character 準拠のメイン 3 項目
const MAIN_FIELDS: { key: keyof CharacterProfile; label: string }[] = [
  { key: 'appearance', label: '外見' },
  { key: 'personality', label: '性格' },
  { key: 'background', label: '背景' },
];

// 詳細折り畳みに退避する Story-attic 独自項目
const DETAIL_FIELDS: { key: keyof CharacterProfile; label: string }[] = [
  { key: 'gender', label: '性別' },
  { key: 'age', label: '年齢' },
  { key: 'occupation', label: '職業' },
];

function parseData(raw: string): CharacterData {
  try {
    const parsed = JSON.parse(raw);
    return {
      profile: { ...DEFAULT_CHARACTER_DATA.profile, ...parsed.profile },
      tabs: Array.isArray(parsed.tabs) ? parsed.tabs : [],
      extra_fields: Array.isArray(parsed.extra_fields) ? parsed.extra_fields : [],
    };
  } catch {
    return { ...DEFAULT_CHARACTER_DATA };
  }
}

export function CharacterDetail({
  character,
  tags,
  projectId,
  onBack,
  onUpdate,
  onTagsChange,
}: CharacterDetailProps) {
  const [name, setName] = useState(character.name);
  const [category, setCategory] = useState(character.category);
  const [data, setData] = useState<CharacterData>(() => parseData(character.data));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [activeCustomTab, setActiveCustomTab] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setName(character.name);
    setCategory(character.category);
    setData(parseData(character.data));
    setActiveCustomTab(null);
  }, [character.id, character.name, character.category, character.data]);

  const save = useCallback(
    (newName: string, newCategory: string, newData: CharacterData) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await invoke('update_character', {
            id: character.id,
            name: newName,
            category: newCategory,
            data: JSON.stringify(newData),
          });
          onUpdate();
        } catch {
          /* 無視 */
        }
      }, 500);
    },
    [character.id, onUpdate],
  );

  const updateName = (v: string) => { setName(v); save(v, category, data); };
  const updateCategory = (v: string) => { setCategory(v); save(name, v, data); };

  const updateProfile = (key: keyof CharacterProfile, value: string) => {
    const newData = { ...data, profile: { ...data.profile, [key]: value } };
    setData(newData);
    save(name, category, newData);
  };

  const updateTabContent = (index: number, content: string) => {
    const newTabs = [...data.tabs];
    newTabs[index] = { ...newTabs[index], content };
    const newData = { ...data, tabs: newTabs };
    setData(newData);
    save(name, category, newData);
  };

  const addTab = () => {
    const newTab: CharacterTab = { name: '新しいタブ', content: '' };
    const newData = { ...data, tabs: [...data.tabs, newTab] };
    setData(newData);
    setActiveCustomTab(newData.tabs.length - 1);
    save(name, category, newData);
  };

  const renameTab = (index: number, newName: string) => {
    const newTabs = [...data.tabs];
    newTabs[index] = { ...newTabs[index], name: newName };
    const newData = { ...data, tabs: newTabs };
    setData(newData);
    save(name, category, newData);
  };

  const deleteTab = (index: number) => {
    const newTabs = data.tabs.filter((_, i) => i !== index);
    const newData = { ...data, tabs: newTabs };
    setData(newData);
    setActiveCustomTab(null);
    save(name, category, newData);
  };

  const addExtraField = () => {
    const field: CharacterExtraField = { label: '', value: '' };
    const newData = { ...data, extra_fields: [...data.extra_fields, field] };
    setData(newData);
    save(name, category, newData);
  };

  const updateExtraField = (index: number, key: 'label' | 'value', val: string) => {
    const newFields = [...data.extra_fields];
    newFields[index] = { ...newFields[index], [key]: val };
    const newData = { ...data, extra_fields: newFields };
    setData(newData);
    save(name, category, newData);
  };

  const deleteExtraField = (index: number) => {
    const newFields = data.extra_fields.filter((_, i) => i !== index);
    const newData = { ...data, extra_fields: newFields };
    setData(newData);
    save(name, category, newData);
  };

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <div
        className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <button
          className="text-xs"
          style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={onBack}
          title="一覧に戻る"
        >
          ←
        </button>
        <input
          className="flex-1 text-sm font-medium bg-transparent outline-none"
          style={{ color: 'var(--text)', border: 'none' }}
          value={name}
          onChange={(e) => updateName(e.target.value)}
          placeholder="キャラクター名"
        />
      </div>

      {/* カテゴリ (= ASB role) */}
      <div className="px-3 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
        <FieldRow label="役割">
          <input
            className="w-full text-xs bg-transparent outline-none"
            style={{ color: 'var(--text)', border: 'none' }}
            value={category}
            onChange={(e) => updateCategory(e.target.value)}
            placeholder="主要人物、サブキャラなど"
          />
        </FieldRow>
      </div>

      {/* メイン本体 */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="flex flex-col gap-2">
          {MAIN_FIELDS.map((f) => (
            <FieldRow key={f.key} label={f.label}>
              <textarea
                className="w-full text-xs bg-transparent outline-none resize-none"
                style={{
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  padding: '4px 6px',
                  minHeight: '60px',
                }}
                value={data.profile[f.key]}
                onChange={(e) => updateProfile(f.key, e.target.value)}
              />
            </FieldRow>
          ))}

          {/* タグ */}
          <div className="mt-2">
            <span className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>タグ</span>
            <TagPicker
              projectId={projectId}
              entityType="character"
              entityId={character.id}
              tags={tags}
              onTagsChange={onTagsChange}
            />
          </div>

          {/* 詳細折り畳み */}
          <div
            className="mt-3"
            style={{ borderTop: '1px solid var(--border)', paddingTop: '8px' }}
          >
            <button
              className="flex items-center gap-1 text-xs w-full text-left"
              style={{
                color: 'var(--text-muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 0',
              }}
              onClick={() => setDetailsOpen((v) => !v)}
            >
              <span>{detailsOpen ? '▼' : '▶'}</span>
              <span>詳細</span>
            </button>

            {detailsOpen && (
              <div className="flex flex-col gap-2 mt-2">
                {DETAIL_FIELDS.map((f) => (
                  <FieldRow key={f.key} label={f.label}>
                    <input
                      className="w-full text-xs bg-transparent outline-none"
                      style={{
                        color: 'var(--text)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        padding: '2px 6px',
                      }}
                      value={data.profile[f.key]}
                      onChange={(e) => updateProfile(f.key, e.target.value)}
                    />
                  </FieldRow>
                ))}

                {/* エクストラフィールド */}
                <div className="mt-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>追加フィールド</span>
                    <button
                      className="text-xs"
                      style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                      onClick={addExtraField}
                    >
                      + 追加
                    </button>
                  </div>
                  {data.extra_fields.map((field, i) => (
                    <div key={i} className="flex items-start gap-1 mb-1">
                      <input
                        className="text-xs bg-transparent outline-none"
                        style={{ color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 4px', width: '72px' }}
                        value={field.label}
                        onChange={(e) => updateExtraField(i, 'label', e.target.value)}
                        placeholder="ラベル"
                      />
                      <input
                        className="flex-1 text-xs bg-transparent outline-none"
                        style={{ color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 4px' }}
                        value={field.value}
                        onChange={(e) => updateExtraField(i, 'value', e.target.value)}
                        placeholder="値"
                      />
                      <button
                        className="text-xs flex-shrink-0"
                        style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}
                        onClick={() => deleteExtraField(i)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                {/* カスタムタブ */}
                <div className="mt-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>カスタムタブ</span>
                    <button
                      className="text-xs"
                      style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                      onClick={addTab}
                    >
                      + 追加
                    </button>
                  </div>

                  {data.tabs.length > 0 && (
                    <div className="flex items-center gap-0.5 overflow-x-auto" style={{ borderBottom: '1px solid var(--border)' }}>
                      {data.tabs.map((tab, i) => (
                        <SubTab
                          key={i}
                          active={activeCustomTab === i}
                          onClick={() => setActiveCustomTab(activeCustomTab === i ? null : i)}
                          label={tab.name}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            const newName = prompt('タブ名を入力', tab.name);
                            if (newName !== null) renameTab(i, newName);
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {activeCustomTab !== null && data.tabs[activeCustomTab] && (
                    <div className="flex flex-col mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {data.tabs[activeCustomTab].name}
                        </span>
                        <button
                          className="text-xs"
                          style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}
                          onClick={() => deleteTab(activeCustomTab)}
                        >
                          削除
                        </button>
                      </div>
                      <textarea
                        className="w-full text-xs bg-transparent outline-none resize-none"
                        style={{
                          color: 'var(--text)',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          padding: '6px',
                          minHeight: '100px',
                        }}
                        value={data.tabs[activeCustomTab].content}
                        onChange={(e) => updateTabContent(activeCustomTab, e.target.value)}
                        placeholder="自由にメモを記入..."
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</span>
      {children}
    </div>
  );
}

function SubTab({
  active,
  onClick,
  label,
  onContextMenu,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      className="text-xs px-2 py-1 whitespace-nowrap"
      style={{
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        background: 'none',
        border: 'none',
        borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
        cursor: 'pointer',
      }}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {label}
    </button>
  );
}

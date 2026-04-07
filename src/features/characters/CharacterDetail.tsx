/**
 * キャラクター詳細 — プロフィール・カスタムタブ・タグ
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Character, CharacterData, CharacterProfile, CharacterTab, CharacterExtraField, Tag } from '@/shared/types';
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

// プロフィールフィールド定義
const PROFILE_FIELDS: { key: keyof CharacterProfile; label: string }[] = [
  { key: 'gender', label: '性別' },
  { key: 'age', label: '年齢' },
  { key: 'occupation', label: '職業' },
  { key: 'appearance', label: '外見' },
  { key: 'personality', label: '性格' },
  { key: 'background', label: '背景' },
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
  const [activeTab, setActiveTab] = useState<'profile' | number>('profile');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // キャラクター切替時にリセット
  useEffect(() => {
    setName(character.name);
    setCategory(character.category);
    setData(parseData(character.data));
    setActiveTab('profile');
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

  const updateName = (v: string) => {
    setName(v);
    save(v, category, data);
  };

  const updateCategory = (v: string) => {
    setCategory(v);
    save(name, v, data);
  };

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
    setActiveTab(newData.tabs.length - 1);
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
    setActiveTab('profile');
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
      {/* ヘッダー: 戻るボタン + 名前 */}
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

      {/* カテゴリ */}
      <div className="px-3 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
        <FieldRow label="カテゴリ">
          <input
            className="w-full text-xs bg-transparent outline-none"
            style={{ color: 'var(--text)', border: 'none' }}
            value={category}
            onChange={(e) => updateCategory(e.target.value)}
            placeholder="主要人物、サブキャラなど"
          />
        </FieldRow>
      </div>

      {/* サブタブ: プロフィール + カスタムタブ */}
      <div className="flex items-center gap-0.5 px-2 pt-1 flex-shrink-0 overflow-x-auto"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <SubTab
          active={activeTab === 'profile'}
          onClick={() => setActiveTab('profile')}
          label="プロフィール"
        />
        {data.tabs.map((tab, i) => (
          <SubTab
            key={i}
            active={activeTab === i}
            onClick={() => setActiveTab(i)}
            label={tab.name}
            onContextMenu={(e) => {
              e.preventDefault();
              const newName = prompt('タブ名を入力', tab.name);
              if (newName !== null) renameTab(i, newName);
            }}
          />
        ))}
        <button
          className="text-xs px-1.5 py-0.5"
          style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={addTab}
          title="カスタムタブを追加"
        >
          +
        </button>
      </div>

      {/* タブコンテンツ */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {activeTab === 'profile' ? (
          <div className="flex flex-col gap-2">
            {PROFILE_FIELDS.map((f) => (
              <FieldRow key={f.key} label={f.label}>
                {f.key === 'appearance' || f.key === 'personality' || f.key === 'background' ? (
                  <textarea
                    className="w-full text-xs bg-transparent outline-none resize-none"
                    style={{ color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 6px', minHeight: '48px' }}
                    value={data.profile[f.key]}
                    onChange={(e) => updateProfile(f.key, e.target.value)}
                  />
                ) : (
                  <input
                    className="w-full text-xs bg-transparent outline-none"
                    style={{ color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px' }}
                    value={data.profile[f.key]}
                    onChange={(e) => updateProfile(f.key, e.target.value)}
                  />
                )}
              </FieldRow>
            ))}

            {/* エクストラフィールド */}
            <div className="mt-2">
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
                    style={{ color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 4px', width: '60px' }}
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
          </div>
        ) : typeof activeTab === 'number' && data.tabs[activeTab] ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                {data.tabs[activeTab].name}
              </span>
              <button
                className="text-xs"
                style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => deleteTab(activeTab as number)}
              >
                削除
              </button>
            </div>
            <textarea
              className="flex-1 w-full text-xs bg-transparent outline-none resize-none"
              style={{ color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '6px', minHeight: '120px' }}
              value={data.tabs[activeTab].content}
              onChange={(e) => updateTabContent(activeTab as number, e.target.value)}
              placeholder="自由にメモを記入..."
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** フィールド行（ラベル + 入力） */
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</span>
      {children}
    </div>
  );
}

/** サブタブボタン */
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

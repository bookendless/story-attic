export type SettingsCategoryKey = 'writing' | 'data' | 'proofread' | 'ambience' | 'ai';

export interface SettingsCategory {
  key: SettingsCategoryKey;
  label: string;
  sub: string;
  icon: string;
}

export const CATEGORIES: SettingsCategory[] = [
  { key: 'writing',   label: '執筆環境',     sub: 'エディタ・原稿・テーマ',  icon: '✎' },
  { key: 'data',      label: '保存・データ',  sub: '自動保存・ストレージ',   icon: '◇' },
  { key: 'proofread', label: '校正',          sub: '誤用・冗長表現の検出',   icon: '✓' },
  { key: 'ambience',  label: '演出・サウンド', sub: '雰囲気・環境音',        icon: '✦' },
  { key: 'ai',        label: 'AI',            sub: 'プロバイダー・API',     icon: '◈' },
];

// 既存タブキー（SettingsTab）→ 新カテゴリキーへのマッピング（後方互換）
export const LEGACY_TAB_MAP: Record<string, SettingsCategoryKey> = {
  editor:     'writing',
  save:       'data',
  display:    'writing',
  manuscript: 'writing',
  proofread:  'proofread',
  ambience:   'ambience',
  sound:      'ambience',
  ai:         'ai',
  storage:    'data',
};

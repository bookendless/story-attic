// =========================================
// 共通型定義（Rustモデルと対応）
// =========================================

export interface ProjectSummary {
  id: string;
  title: string;
  author: string;
  description: string;
  episodeCount: number;
  totalChars: number;
  updatedAt: string;
  createdAt: string;
}

export interface Project {
  id: string;
  title: string;
  author: string;
  description: string;
  settings: ProjectSettings;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectUpdate {
  title?: string;
  author?: string;
  description?: string;
}

export interface Episode {
  id: string;
  projectId: string;
  title: string;
  body: string;
  sortOrder: number;
  charCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EpisodeSummary {
  id: string;
  projectId: string;
  title: string;
  sortOrder: number;
  charCount: number;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  projectId: string;
  title: string;
  sortOrder: number;
  createdAt: string;
}

export interface ChapterWithEpisodes {
  chapter: Chapter;
  episodes: EpisodeSummary[];
}

export interface ChapterTree {
  chapters: ChapterWithEpisodes[];
  ungrouped: EpisodeSummary[];
}

export interface ProjectSettings {
  auto_indent: boolean;
  auto_save: boolean;
  auto_save_interval_sec: number;
  show_char_count: boolean;
  chars_per_line: number;
  lines_per_page: number;
  editor_font: string;
  editor_font_size: number;
  editor_max_width: number;
}

export interface ProofreadSettings {
  enabled: boolean;
  categories: Record<string, boolean>;
  popup_enabled: boolean;
}

export const DEFAULT_PROOFREAD_SETTINGS: ProofreadSettings = {
  enabled: true,
  categories: {
    '二重表現': true,
    '誤用': true,
    '冗長表現': true,
    '記号': true,
  },
  popup_enabled: true,
};

export const DEFAULT_SETTINGS: ProjectSettings = {
  auto_indent: true,
  auto_save: true,
  auto_save_interval_sec: 60,
  show_char_count: true,
  chars_per_line: 40,
  lines_per_page: 20,
  editor_font: '游明朝',
  editor_font_size: 16,
  editor_max_width: 860,
};

// =========================================
// 文章分析
// =========================================

export interface AnalysisResult {
  charCount: number;
  lineCount: number;
  paragraphCount: number;
  sentenceCount: number;
  hiraganaRate: number;
  katakanaRate: number;
  kanjiRate: number;
  avgSentenceLength: number;
  dialogueRate: number;
  sentenceLengths: number[];
  dialogueRatios: number[];
}

// =========================================
// 校正
// =========================================

export interface ProofIssue {
  category: string;
  message: string;
  suggestion: string | null;
  offset: number;
  length: number;
  severity: 'error' | 'warning' | 'info';
}

// =========================================
// AI連携（Rust側 src-tauri/src/models/ai.rs と対応）
// =========================================

/** AIプロバイダー識別子 */
export type AiProvider = 'openai' | 'anthropic' | 'local';

/** チャットメッセージの役割（Rust側送信時の値と一致） */
export type AiMessageRole = 'user' | 'assistant' | 'system';

/**
 * AIに送信するチャットメッセージ。
 * `ai_send_message` コマンドの `messages` 引数として使用する。
 */
export interface AiMessage {
  role: AiMessageRole;
  content: string;
}

/**
 * AI設定（プロジェクト単位で保存）。
 * フィールド名はRust側 `AiSettings` と DB に合わせて snake_case。
 * `provider` は未選択時に空文字となるため、ここでは `string` のまま受ける。
 */
export interface AiSettings {
  /** プロバイダー識別子。未選択時は空文字 */
  provider: string;
  /** モデル名 */
  model: string;
  /** システムプロンプト */
  system_prompt: string;
  /** ローカルLLM用ベースURL（未設定時は null） */
  base_url: string | null;
}

/**
 * ストリーミング応答のチャンクペイロード。
 * Tauriイベント `ai-chunk` の payload 型で、Rust側 `AiChunkPayload` と対応。
 */
export interface AiChunkPayload {
  content: string;
  done: boolean;
  error?: string;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: '',
  model: '',
  system_prompt: '',
  base_url: null,
};

// =========================================
// スナップショット
// =========================================

export interface Snapshot {
  id: string;
  episodeId: string;
  body: string;
  charCount: number;
  createdAt: string;
}

export interface SnapshotSummary {
  id: string;
  episodeId: string;
  charCount: number;
  createdAt: string;
}

// =========================================
// タグ
// =========================================

export interface Tag {
  id: string;
  projectId: string;
  entityType: string;
  entityId: string;
  tag: string;
}

// =========================================
// キャラクター
// =========================================

export interface Character {
  id: string;
  projectId: string;
  category: string;
  name: string;
  /** JSON文字列: { profile, tabs, extra_fields } */
  data: string;
  sortOrder: number;
}

/** キャラクターのプロフィール構造 */
export interface CharacterProfile {
  gender: string;
  age: string;
  occupation: string;
  appearance: string;
  personality: string;
  background: string;
}

/** キャラクターのカスタムタブ */
export interface CharacterTab {
  name: string;
  content: string;
}

/** キャラクターのエクストラフィールド */
export interface CharacterExtraField {
  label: string;
  value: string;
}

/** data JSONのパース済み構造 */
export interface CharacterData {
  profile: CharacterProfile;
  tabs: CharacterTab[];
  extra_fields: CharacterExtraField[];
}

export const DEFAULT_CHARACTER_DATA: CharacterData = {
  profile: {
    gender: '',
    age: '',
    occupation: '',
    appearance: '',
    personality: '',
    background: '',
  },
  tabs: [],
  extra_fields: [],
};

// =========================================
// 用語集
// =========================================

export interface GlossaryItem {
  id: string;
  projectId: string;
  category: string;
  term: string;
  /** JSON文字列: { reading, description, related } */
  data: string;
  sortOrder: number;
}

export interface GlossaryData {
  reading: string;
  description: string;
  related: string;
}

export const DEFAULT_GLOSSARY_DATA: GlossaryData = {
  reading: '',
  description: '',
  related: '',
};

// =========================================
// メモ
// =========================================

export interface Memo {
  id: string;
  projectId: string;
  category: string;
  title: string;
  /** JSON文字列: { content } */
  data: string;
  sortOrder: number;
}

export interface MemoData {
  content: string;
}

export const DEFAULT_MEMO_DATA: MemoData = {
  content: '',
};

// =========================================
// 資料
// =========================================

export interface Material {
  id: string;
  projectId: string;
  book: string;
  category: string;
  title: string;
  /** JSON文字列: { content, source, url } */
  data: string;
  sortOrder: number;
}

export interface MaterialData {
  content: string;
  source: string;
  url: string;
}

export const DEFAULT_MATERIAL_DATA: MaterialData = {
  content: '',
  source: '',
  url: '',
};

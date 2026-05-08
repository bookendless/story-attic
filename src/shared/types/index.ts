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

export interface ChapterNode {
  id: string;
  label: string;
  content: string;
  children: ChapterNode[];
}

export interface Chapter {
  id: string;
  projectId: string;
  title: string;
  summary: string;
  nodes: string;
  sortOrder: number;
  createdAt: string;
  setting: string;
  mood: string;
  importantEvents: string;
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
    '助詞重複': true,
    'ら抜き言葉': true,
    '禁則文字': true,
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

export interface WordFrequency {
  word: string;
  count: number;
}

export interface KanjiFrequency {
  kanji: string;
  count: number;
}

export interface StructureSection {
  label: string;
  charRatio: number;
  dialogueRate: number;
  avgSentenceLength: number;
}

export interface AnalysisResult {
  // 基本統計
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

  // 語彙分析
  wordFrequencies: WordFrequency[];
  vocabularyDiversity: number;
  uniqueTokenCount: number;
  totalTokenCount: number;

  // テンポ分析
  rhythmVariance: number;
  rhythmStddev: number;
  dialogueNarrativePattern: boolean[];
  sceneBreakCount: number;
  paragraphDensity: number;

  // 構造分析
  estimatedStructure: StructureSection[];
  climaxPosition: number;
  intensityCurve: number[];

  // 文体分析拡張
  politeFormCount: number;
  plainFormCount: number;
  politeFormRatio: number;
  mixedStyleWarnings: number[];

  // 読みやすさ
  estimatedReadingMinutes: number;
  difficultKanji: KanjiFrequency[];
  uniqueKanjiCount: number;

  // 構造拡張
  avgParagraphLength: number;
  maxSentenceLength: number;
  paragraphLengths: number[];

  // テンポ拡張
  verbDensity: number;
  adjDensity: number;
  psychoDensity: number;

  // 語彙拡張
  difficultWordRate: number;
  metaphorRate: number;
  katakanaWordCount: number;
  verbCount: number;
  adjCount: number;
  psychoWordCount: number;
  metaphorCount: number;

  // 人物＆視点
  firstPersonCount: number;
  povSwitchCount: number;
  questionSentenceCount: number;
  narratorType: string;
  narratorAnalysis: string;

  // 感情
  positiveWordCount: number;
  negativeWordCount: number;
  tensionWordCount: number;
  emotionCurve: number[];

  // 文章
  readabilityScore: number;
  writingRhythm: number;

  // 感覚語バランス
  sensoryVisualCount: number;
  sensoryAuditoryCount: number;
  sensoryTactileCount: number;
  sensoryOlfactoryCount: number;
  sensoryGustatoryCount: number;
}

// =========================================
// 台詞抽出
// =========================================

export interface DialogueItem {
  text: string;
  paragraphIndex: number;
  offset: number;
  bracketType: 'normal' | 'double' | 'paren';
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
export type AiProvider = 'openai' | 'anthropic' | 'google' | 'xai' | 'local';

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
  /** システムプロンプト（設定保存用。送信時はcatalystPromptBuilderが動的構築） */
  system_prompt: string;
  /** ローカルLLM用ベースURL（未設定時は null） */
  base_url: string | null;
  /** 作家タイプ（プロジェクト単位で永続化） */
  creator_type?: string;
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
// AIペルソナ・口調・コンテキスト
// =========================================

/** AI口調 */
export type AiTone = 'formal' | 'casual' | 'harsh';

/** AIコンテキストソース */
export type AiContextSource = 'body' | 'characters' | 'glossary' | 'plot' | 'worldbuilding' | 'synopsis' | 'foreshadowing';

// =========================================
// AI Creator OS
// =========================================

/** 創作フェーズ */
export type CreativePhase = 'explore' | 'structure' | 'write' | 'revise';

/** 作家タイプ */
export type CreatorType = 'explorer' | 'architect';

/** 停滞タイプ */
export type BlockType = 'none' | 'idea' | 'structure' | 'motivation';

/** 作品のCore（重力の中心） */
export interface CreativeCore {
  theme: string;
  centralEmotion: string;
  coreQuestion: string;
}

// =========================================
// スナップショット
// =========================================

export interface Snapshot {
  id: string;
  episodeId: string;
  body: string;
  charCount: number;
  label: string;
  createdAt: string;
}

export interface SnapshotSummary {
  id: string;
  episodeId: string;
  charCount: number;
  label: string;
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

// =========================================
// プロット
// =========================================

export interface Plot {
  id: string;
  projectId: string;
  title: string;
  plotType: string;
  theme: string;
  data: string;
  sortOrder: number;
  isPinned: boolean;
}

export interface PlotNode {
  id: string;
  label: string;
  content: string;
  children: PlotNode[];
}

export interface PlotData {
  nodes: PlotNode[];
}

export const DEFAULT_PLOT_DATA: PlotData = { nodes: [] };

// PLOT_TYPE_PRESETS: ASB 6 構造に対応したフェーズラベル。
// キーは PlotStructureType と一致。カスタムは空配列。
export const PLOT_TYPE_PRESETS: Record<string, string[]> = {
  kishotenketsu: ['起', '承', '転', '結'],
  'three-act': ['第1幕', '第2幕', '第3幕'],
  'four-act': ['第1幕', '第2幕', '第3幕', '第4幕'],
  'heroes-journey': [
    '日常の世界', '冒険への誘い', '境界越え', '試練と仲間',
    '最大の試練', '報酬', '帰路', '復活と帰還',
  ],
  'beat-sheet': [
    '導入', '決断', '試練', '転換点', '危機', 'クライマックス', '結末',
  ],
  'mystery-suspense': [
    '発端', '捜査（初期）', '仮説とミスリード', '第二の事件',
    '手がかりの統合', '解決', 'エピローグ',
  ],
  'カスタム': [],
};

// =========================================
// プロット構造 (ASB 基準)
// =========================================

export interface PlotStructure {
  projectId: string;
  data: string;
}

/** ASB Plot 準拠の 6 項目 + 構造タイプ + Creative Core拡張 */
export interface PlotStructureData {
  theme: string;
  setting: string;
  hook: string;
  protagonistGoal: string;
  mainObstacles: string;
  ending: string;
  /** PlotStructureType のキー。未選択時は空文字 */
  structureType: string;
  /** AI Creator OS: 作品の中心感情 */
  centralEmotion?: string;
  /** AI Creator OS: 作品を貫く問い */
  coreQuestion?: string;
}

export const DEFAULT_PLOT_STRUCTURE_DATA: PlotStructureData = {
  theme: '',
  setting: '',
  hook: '',
  protagonistGoal: '',
  mainObstacles: '',
  ending: '',
  structureType: '',
  centralEmotion: '',
  coreQuestion: '',
};

// =========================================
// タイムライン
// =========================================

export interface Timeline {
  id: string;
  projectId: string;
  chapterId: string | null;
  title: string;
  data: string;
}

export interface TimelineCell {
  value: string;
}

export interface TimelineData {
  headers: string[];
  rows: TimelineCell[][];
}

export const DEFAULT_TIMELINE_DATA: TimelineData = {
  headers: ['時間', 'イベント', '場所', '人物', 'メモ'],
  rows: [],
};

// =========================================
// 執筆日記
// =========================================

export interface DiaryEntry {
  projectId: string;
  date: string;
  charCount: number;
  sessionSec: number;
}

// =========================================
// あらすじ
// =========================================

export interface Synopsis {
  id: string;
  projectId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// =========================================
// 伏線トラッカー
// =========================================

export interface PlotThread {
  id: string;
  projectId: string;
  title: string;
  category: string;
  /** JSON文字列: PlotThreadData */
  data: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlotThreadPoint {
  type: string;
  chapter: string;
  content: string;
}

export interface PlotThreadData {
  status: string;
  importance: string;
  description: string;
  points: PlotThreadPoint[];
  relatedCharacters: string[];
  resolution: string;
  notes: string;
  recommendedPlacement: string;
  expectedEffect: string;
}

export const DEFAULT_PLOT_THREAD_DATA: PlotThreadData = {
  status: '',
  importance: '',
  description: '',
  points: [],
  relatedCharacters: [],
  resolution: '',
  notes: '',
  recommendedPlacement: '',
  expectedEffect: '',
};

// =========================================
// キャラクター相関図
// =========================================

export interface Correlation {
  id: string;
  projectId: string;
  title: string;
  /** JSON文字列: CorrelationData */
  data: string;
}

export interface CorrelationNode {
  id: string;
  name: string;
  characterId: string;
}

export interface CorrelationEdge {
  from: string;
  to: string;
  type: string;
  intensity: number;
  description: string;
  notes: string;
}

export interface CorrelationData {
  nodes: CorrelationNode[];
  edges: CorrelationEdge[];
}

// =========================================
// AI Story Builder インポート
// =========================================

export interface ParsedBasicInfo {
  genre: string;
  subGenre: string;
  targetReaders: string;
  theme: string;
}

export interface ParsedCharacter {
  name: string;
  meta: string;
  appearance: string;
  personality: string;
  background: string;
}

export interface ParsedPlotPhase {
  label: string;
  content: string;
}

export interface ParsedPlot {
  theme: string;
  setting: string;
  hook: string;
  protagonistGoal: string;
  mainObstacles: string;
  ending: string;
  structureType: string;
  phases: ParsedPlotPhase[];
}

export interface ParsedChapter {
  number: number;
  title: string;
  summary: string;
  setting: string;
  mood: string;
  importantEvents: string;
}

export interface ParsedDraft {
  chapterRef: string | null;
  body: string;
}

export interface ParsedGlossaryItem {
  term: string;
  reading: string;
  termType: string;
  definition: string;
}

export interface ParsedRelationship {
  fromName: string;
  toName: string;
  relationType: string;
  intensity: number;
  description: string;
  notes: string;
}

export interface ParsedWorldSetting {
  title: string;
  category: string;
  content: string;
}

export interface ParsedPlotThreadPoint {
  pointType: string;
  chapter: string;
  content: string;
}

export interface ParsedPlotThread {
  title: string;
  category: string;
  status: string;
  importance: string;
  description: string;
  points: ParsedPlotThreadPoint[];
  relatedCharacters: string[];
  resolution: string;
  notes: string;
  recommendedPlacement: string;
  expectedEffect: string;
}

export interface ParsedStoryProject {
  title: string;
  overview: string;
  basicInfo: ParsedBasicInfo;
  characters: ParsedCharacter[];
  plot: ParsedPlot;
  synopsis: string;
  chapters: ParsedChapter[];
  drafts: ParsedDraft[];
  glossary: ParsedGlossaryItem[];
  relationships: ParsedRelationship[];
  worldSettings: ParsedWorldSetting[];
  plotThreads: ParsedPlotThread[];
}

export interface ImportSections {
  characters: boolean;
  plot: boolean;
  synopsis: boolean;
  chapters: boolean;
  draft: boolean;
  glossary: boolean;
  relationships: boolean;
  worldSettings: boolean;
  plotThreads: boolean;
}

export interface ImportOptions {
  targetProjectId: string | null;
  sections: ImportSections;
}

export interface ImportCounts {
  characters: number;
  chapters: number;
  episodes: number;
  glossaryItems: number;
  relationships: number;
  worldSettings: number;
  plotThreads: number;
  synopsis: number;
  plotPhases: number;
}

export interface ImportResult {
  projectId: string;
  counts: ImportCounts;
}

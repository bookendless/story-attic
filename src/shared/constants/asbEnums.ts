/**
 * AI Story Builder 互換 enum 群
 *
 * ASB のデータ構造に合わせた固定値セット。日本語ラベルも同梱。
 */

// =========================================
// 相関図 (CharacterRelationship.type)
// =========================================

export type RelationshipType = 'friend' | 'enemy' | 'family' | 'romantic' | 'mentor' | 'rival' | 'other';

export const RELATIONSHIP_TYPE_LABELS: Record<RelationshipType, string> = {
  friend: '友人',
  enemy: '敵対',
  family: '家族',
  romantic: '恋愛',
  mentor: '師弟',
  rival: 'ライバル',
  other: 'その他',
};

export const RELATIONSHIP_TYPE_COLORS: Record<RelationshipType, string> = {
  friend: '#10b981',
  enemy: '#ef4444',
  family: '#3b82f6',
  romantic: '#ec4899',
  mentor: '#a855f7',
  rival: '#f97316',
  other: '#6b7280',
};

export const RELATIONSHIP_TYPES: RelationshipType[] = [
  'friend', 'enemy', 'family', 'romantic', 'mentor', 'rival', 'other',
];

// =========================================
// 伏線 (Foreshadowing)
// =========================================

export type ForeshadowingStatus = 'planted' | 'hinted' | 'resolved' | 'abandoned';

export const FORESHADOWING_STATUS_LABELS: Record<ForeshadowingStatus, string> = {
  planted: '設置済み',
  hinted: 'ヒント提示',
  resolved: '回収済み',
  abandoned: '破棄',
};

export const FORESHADOWING_STATUSES: ForeshadowingStatus[] = [
  'planted', 'hinted', 'resolved', 'abandoned',
];

export type ForeshadowingImportance = 'high' | 'medium' | 'low';

export const FORESHADOWING_IMPORTANCE_LABELS: Record<ForeshadowingImportance, string> = {
  high: '★★★高',
  medium: '★★中',
  low: '★低',
};

export const FORESHADOWING_IMPORTANCES: ForeshadowingImportance[] = ['high', 'medium', 'low'];

export type ForeshadowingCategory = 'character' | 'plot' | 'world' | 'mystery' | 'relationship' | 'other';

export const FORESHADOWING_CATEGORY_LABELS: Record<ForeshadowingCategory, string> = {
  character: 'キャラクター',
  plot: 'プロット',
  world: '世界観',
  mystery: 'ミステリー',
  relationship: '関係性',
  other: 'その他',
};

export const FORESHADOWING_CATEGORIES: ForeshadowingCategory[] = [
  'character', 'plot', 'world', 'mystery', 'relationship', 'other',
];

export type ForeshadowingPointType = 'plant' | 'hint' | 'payoff';

export const FORESHADOWING_POINT_TYPE_LABELS: Record<ForeshadowingPointType, string> = {
  plant: '設置',
  hint: 'ヒント',
  payoff: '回収',
};

// =========================================
// 用語集 (GlossaryTerm.category)
// =========================================

export type GlossaryCategory = 'character' | 'location' | 'concept' | 'item' | 'other';

export const GLOSSARY_CATEGORY_LABELS: Record<GlossaryCategory, string> = {
  character: 'キャラクター',
  location: '場所・舞台',
  concept: '概念・用語',
  item: 'アイテム',
  other: 'その他',
};

export const GLOSSARY_CATEGORIES: GlossaryCategory[] = [
  'character', 'location', 'concept', 'item', 'other',
];

// =========================================
// 世界観設定 (WorldSetting.category)
// =========================================

export type WorldCategory =
  | 'geography' | 'society' | 'culture' | 'technology' | 'magic'
  | 'history' | 'politics' | 'economy' | 'religion' | 'other';

export const WORLD_CATEGORY_LABELS: Record<WorldCategory, string> = {
  geography: '地理',
  society: '社会',
  culture: '文化',
  technology: '技術',
  magic: '魔法',
  history: '歴史',
  politics: '政治',
  economy: '経済',
  religion: '宗教',
  other: 'その他',
};

export const WORLD_CATEGORIES: WorldCategory[] = [
  'geography', 'society', 'culture', 'technology', 'magic',
  'history', 'politics', 'economy', 'religion', 'other',
];

// =========================================
// プロット構造 (PlotStructure.structure)
// =========================================

export type PlotStructureType =
  | 'kishotenketsu' | 'three-act' | 'four-act'
  | 'heroes-journey' | 'beat-sheet' | 'mystery-suspense';

export const PLOT_STRUCTURE_LABELS: Record<PlotStructureType, string> = {
  kishotenketsu: '起承転結',
  'three-act': '三幕構成',
  'four-act': '四幕構成',
  'heroes-journey': 'ヒーローズ・ジャーニー',
  'beat-sheet': 'ビートシート',
  'mystery-suspense': 'ミステリー・サスペンス',
};

export const PLOT_STRUCTURE_TYPES: PlotStructureType[] = [
  'kishotenketsu', 'three-act', 'four-act',
  'heroes-journey', 'beat-sheet', 'mystery-suspense',
];

/** プロット構造のフェーズ定義（色・ラベル） */
export interface PlotPhaseConfig {
  key: string;
  label: string;
  description: string;
  color: string;       // SVG/背景色（hex）
  lightBg: string;     // 薄背景（tailwind from-xxx-50）
}

export const PLOT_STRUCTURE_PHASES: Record<PlotStructureType, PlotPhaseConfig[]> = {
  kishotenketsu: [
    { key: 'ki', label: '起 - 導入', description: '物語の始まり', color: '#3b82f6', lightBg: '#dbeafe' },
    { key: 'sho', label: '承 - 展開', description: '事件の発展', color: '#10b981', lightBg: '#d1fae5' },
    { key: 'ten', label: '転 - 転換', description: '大きな変化', color: '#f97316', lightBg: '#ffedd5' },
    { key: 'ketsu', label: '結 - 結末', description: '物語の終結', color: '#a855f7', lightBg: '#f3e8ff' },
  ],
  'three-act': [
    { key: 'act1', label: '第1幕 - 導入', description: '物語の始まりと設定', color: '#3b82f6', lightBg: '#dbeafe' },
    { key: 'act2', label: '第2幕 - 展開', description: '物語の核心部分', color: '#10b981', lightBg: '#d1fae5' },
    { key: 'act3', label: '第3幕 - 結末', description: '物語の解決と結末', color: '#a855f7', lightBg: '#f3e8ff' },
  ],
  'four-act': [
    { key: 'fourAct1', label: '第1幕 - 秩序', description: '日常の確立', color: '#3b82f6', lightBg: '#dbeafe' },
    { key: 'fourAct2', label: '第2幕 - 混沌', description: '問題発生と状況悪化', color: '#ef4444', lightBg: '#fee2e2' },
    { key: 'fourAct3', label: '第3幕 - 秩序', description: '解決への取り組み', color: '#10b981', lightBg: '#d1fae5' },
    { key: 'fourAct4', label: '第4幕 - 混沌', description: '最終的な試練と真の解決', color: '#a855f7', lightBg: '#f3e8ff' },
  ],
  'heroes-journey': [
    { key: 'hj1', label: '日常の世界', description: '主人公の現状', color: '#3b82f6', lightBg: '#dbeafe' },
    { key: 'hj2', label: '冒険への誘い', description: '事件の始まり', color: '#10b981', lightBg: '#d1fae5' },
    { key: 'hj3', label: '境界越え', description: '非日常への旅立ち', color: '#eab308', lightBg: '#fef9c3' },
    { key: 'hj4', label: '試練と仲間', description: '敵との遭遇、協力者', color: '#f97316', lightBg: '#ffedd5' },
    { key: 'hj5', label: '最大の試練', description: '物語の底、敗北や死の危険', color: '#ef4444', lightBg: '#fee2e2' },
    { key: 'hj6', label: '報酬', description: '剣（力）の獲得', color: '#a855f7', lightBg: '#f3e8ff' },
    { key: 'hj7', label: '帰路', description: '追跡、脱出', color: '#6366f1', lightBg: '#e0e7ff' },
    { key: 'hj8', label: '復活と帰還', description: '変化した主人公の帰還', color: '#059669', lightBg: '#d1fae5' },
  ],
  'beat-sheet': [
    { key: 'bs1', label: '導入 (Setup)', description: '日常、テーマの提示、きっかけ', color: '#3b82f6', lightBg: '#dbeafe' },
    { key: 'bs2', label: '決断 (Break into Two)', description: '葛藤の末の決断', color: '#10b981', lightBg: '#d1fae5' },
    { key: 'bs3', label: '試練 (Fun and Games)', description: '新しい世界での試行錯誤', color: '#eab308', lightBg: '#fef9c3' },
    { key: 'bs4', label: '転換点 (Midpoint)', description: '物語の中間点、状況の一変', color: '#f97316', lightBg: '#ffedd5' },
    { key: 'bs5', label: '危機 (All Is Lost)', description: '迫り来る敵、絶望', color: '#ef4444', lightBg: '#fee2e2' },
    { key: 'bs6', label: 'クライマックス (Finale)', description: '再起、解決への最後の戦い', color: '#a855f7', lightBg: '#f3e8ff' },
    { key: 'bs7', label: '結末 (Final Image)', description: '変化した世界、新たな日常', color: '#6366f1', lightBg: '#e0e7ff' },
  ],
  'mystery-suspense': [
    { key: 'ms1', label: '発端（事件発生）', description: '不可解な事件の提示', color: '#64748b', lightBg: '#f1f5f9' },
    { key: 'ms2', label: '捜査（初期）', description: '状況確認、関係者への聴取', color: '#6b7280', lightBg: '#f3f4f6' },
    { key: 'ms3', label: '仮説とミスリード', description: '誤った推理、深まる謎', color: '#d97706', lightBg: '#fef3c7' },
    { key: 'ms4', label: '第二の事件/急展開', description: '捜査の行き詰まりや新たな危機', color: '#f97316', lightBg: '#ffedd5' },
    { key: 'ms5', label: '手がかりの統合', description: '真相への気づき', color: '#3b82f6', lightBg: '#dbeafe' },
    { key: 'ms6', label: '解決（真相解明）', description: '犯人の指摘、トリックの暴き', color: '#a855f7', lightBg: '#f3e8ff' },
    { key: 'ms7', label: 'エピローグ', description: '事件後の余韻', color: '#6366f1', lightBg: '#e0e7ff' },
  ],
};

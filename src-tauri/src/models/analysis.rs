use serde::{Deserialize, Serialize};

// =========================================
// 文章分析
// =========================================

/// 語彙頻度エントリ
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WordFrequency {
    pub word: String,
    pub count: usize,
}

/// 漢字頻度エントリ
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanjiFrequency {
    pub kanji: String,
    pub count: usize,
}

/// 構造分析セクション（起承転結等の1区分）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StructureSection {
    /// ラベル（起/承/転/結）
    pub label: String,
    /// 全体に対する文字数比率
    pub char_ratio: f64,
    /// このセクションの台詞率
    pub dialogue_rate: f64,
    /// このセクションの平均文長
    pub avg_sentence_length: f64,
}

/// 文章分析の結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResult {
    // --- 基本統計 ---
    /// 文字数（タグ除外）
    pub char_count: usize,
    /// 行数
    pub line_count: usize,
    /// 段落数
    pub paragraph_count: usize,
    /// 文数
    pub sentence_count: usize,
    /// ひらがな率
    pub hiragana_rate: f64,
    /// カタカナ率
    pub katakana_rate: f64,
    /// 漢字率
    pub kanji_rate: f64,
    /// 平均文長（文字数）
    pub avg_sentence_length: f64,
    /// 台詞率（「」内の文字数 / 全文字数）
    pub dialogue_rate: f64,
    /// 文長推移（グラフ用: 各文の文字数）
    pub sentence_lengths: Vec<usize>,
    /// 段落ごとの台詞比率推移（グラフ用）
    pub dialogue_ratios: Vec<f64>,

    // --- 語彙分析 ---
    /// 頻出語ランキング（上位30）
    pub word_frequencies: Vec<WordFrequency>,
    /// 語彙多様性 (TTR: Type-Token Ratio)
    pub vocabulary_diversity: f64,
    /// ユニークトークン数
    pub unique_token_count: usize,
    /// 総トークン数
    pub total_token_count: usize,

    // --- テンポ分析 ---
    /// 文長分散（リズム均一度の指標）
    pub rhythm_variance: f64,
    /// 文長標準偏差
    pub rhythm_stddev: f64,
    /// 段落ごとの「台詞主体か」フラグ（true=台詞主体）
    pub dialogue_narrative_pattern: Vec<bool>,
    /// 場面転換数（空行・セパレータ行の数）
    pub scene_break_count: usize,
    /// 段落密度（1000文字あたりの段落数）
    pub paragraph_density: f64,

    // --- 構造分析 ---
    /// 起承転結の推定（4セクション）
    pub estimated_structure: Vec<StructureSection>,
    /// クライマックス推定位置（0.0-1.0）
    pub climax_position: f64,
    /// 盛り上がり曲線（10分割した各区間の強度スコア）
    pub intensity_curve: Vec<f64>,

    // --- 文体分析拡張 ---
    /// 敬体の文数
    pub polite_form_count: usize,
    /// 常体の文数
    pub plain_form_count: usize,
    /// 敬体率
    pub polite_form_ratio: f64,
    /// 敬体/常体が混在している文インデックス
    pub mixed_style_warnings: Vec<usize>,

    // --- 読みやすさ ---
    /// 推定読了時間（分）
    pub estimated_reading_minutes: f64,
    /// 検出された難読漢字
    pub difficult_kanji: Vec<KanjiFrequency>,
    /// 使用されているユニーク漢字数
    pub unique_kanji_count: usize,

    // --- 構造拡張 ---
    /// 平均段落長（文字/段落）
    pub avg_paragraph_length: f64,
    /// 最長文の文字数
    pub max_sentence_length: usize,
    /// 各段落の文字数（折れ線グラフ用）
    pub paragraph_lengths: Vec<usize>,

    // --- テンポ拡張 ---
    /// イベント密度（動詞数/文数）
    pub verb_density: f64,
    /// 描写密度・形容詞（個/文）
    pub adj_density: f64,
    /// 心理描写密度（個/文）
    pub psycho_density: f64,

    // --- 語彙拡張 ---
    /// 難語率（難読漢字を含む文の比率）
    pub difficult_word_rate: f64,
    /// 比喩率（比喩表現数/文数）
    pub metaphor_rate: f64,
    /// カタカナ語数（2文字以上の連続カタカナ）
    pub katakana_word_count: usize,
    /// 動詞総数（概算）
    pub verb_count: usize,
    /// 形容詞総数（概算）
    pub adj_count: usize,
    /// 心理語総数
    pub psycho_word_count: usize,
    /// 比喩表現総数
    pub metaphor_count: usize,

    // --- 人物＆視点 ---
    /// 一人称語の出現数
    pub first_person_count: usize,
    /// 視点切替数（一人称⇔三人称の切替）
    pub pov_switch_count: usize,
    /// 疑問文数（？で終わる文）
    pub question_sentence_count: usize,
    /// 語り手タイプ（"一人称" / "三人称" / "混在" / "不明"）
    pub narrator_type: String,
    /// 語り手分析テキスト
    pub narrator_analysis: String,

    // --- 感情 ---
    /// ポジティブ語数
    pub positive_word_count: usize,
    /// ネガティブ語数
    pub negative_word_count: usize,
    /// 緊張語（危機語）数
    pub tension_word_count: usize,
    /// 感情曲線（10ブロック、-1.0〜+1.0）
    pub emotion_curve: Vec<f64>,

    // --- 文章 ---
    /// 読解指数（0〜100、高いほど難解）
    pub readability_score: f64,
    /// 文章リズム（句点間の平均文字数）
    pub writing_rhythm: f64,

    // --- 感覚語バランス ---
    /// 視覚語数
    pub sensory_visual_count: usize,
    /// 聴覚語数
    pub sensory_auditory_count: usize,
    /// 触覚語数
    pub sensory_tactile_count: usize,
    /// 嗅覚語数
    pub sensory_olfactory_count: usize,
    /// 味覚語数
    pub sensory_gustatory_count: usize,
}

// =========================================
// 台詞抽出
// =========================================

/// 抽出された台詞1件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialogueItem {
    /// 台詞テキスト（括弧含む）
    pub text: String,
    /// 段落番号（0始まり）
    pub paragraph_index: usize,
    /// 段落内の文字オフセット
    pub offset: usize,
    /// 括弧の種類（「」=normal, 『』=double, （）=paren）
    pub bracket_type: String,
}

// =========================================
// 校正
// =========================================

/// 校正で検出された問題
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofIssue {
    /// カテゴリ名
    pub category: String,
    /// 問題の説明
    pub message: String,
    /// 修正提案（あれば）
    pub suggestion: Option<String>,
    /// テキスト内の開始位置（文字オフセット）
    pub offset: usize,
    /// 問題箇所の長さ（文字数）
    pub length: usize,
    /// 重要度: "error" | "warning" | "info"
    pub severity: String,
}

/// 校正ルール（内部用）
pub struct ProofRule {
    /// カテゴリ名
    pub category: &'static str,
    /// マッチするパターン（元テキスト）
    pub pattern: &'static str,
    /// 修正提案
    pub suggestion: &'static str,
    /// 問題の説明
    pub message: &'static str,
    /// 重要度
    pub severity: &'static str,
}

use serde::{Deserialize, Serialize};

// =========================================
// 文章分析
// =========================================

/// 文章分析の結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResult {
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

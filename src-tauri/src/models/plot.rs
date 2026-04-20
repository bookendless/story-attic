use serde::{Deserialize, Serialize};

/// プロット
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Plot {
    pub id: String,
    pub project_id: String,
    pub title: String,
    /// "起承転結" | "序破急" | カスタム
    pub plot_type: String,
    pub theme: String,
    /// JSON: ツリーノード構造
    pub data: String,
    pub sort_order: i64,
    /// 決定稿フラグ（1=ピン留め済み、AIの読み込み対象）
    pub is_pinned: bool,
}

/// プロット構造設定（プロジェクトと1:1）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlotStructure {
    pub project_id: String,
    /// JSON: { theme, conflict, ending, ... }
    pub data: String,
}

/// タイムライン
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Timeline {
    pub id: String,
    pub project_id: String,
    pub chapter_id: Option<String>,
    pub title: String,
    /// JSON: スプレッドシート構造
    pub data: String,
}

use serde::{Deserialize, Serialize};

/// 伏線トラッカーエントリ
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlotThread {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub category: String,
    /// JSON: { status, importance, description, points, relatedCharacters, resolution, notes, ... }
    pub data: String,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

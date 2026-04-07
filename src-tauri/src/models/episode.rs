use serde::{Deserialize, Serialize};

/// エピソード（話）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Episode {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub body: String,
    pub sort_order: i64,
    pub char_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

/// 左パネル用の軽量リスト項目（本文は含まない）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpisodeSummary {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub sort_order: i64,
    pub char_count: i64,
    pub updated_at: String,
}

use serde::{Deserialize, Serialize};

/// 資料（3階層: ブック → カテゴリ → アイテム）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Material {
    pub id: String,
    pub project_id: String,
    pub book: String,
    pub category: String,
    pub title: String,
    /// JSON: { content, source, url }
    pub data: String,
    pub sort_order: i64,
}

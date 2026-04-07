use serde::{Deserialize, Serialize};

/// 用語集アイテム
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlossaryItem {
    pub id: String,
    pub project_id: String,
    pub category: String,
    pub term: String,
    /// JSON: { reading, description, related }
    pub data: String,
    pub sort_order: i64,
}

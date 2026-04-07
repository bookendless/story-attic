use serde::{Deserialize, Serialize};

/// メモ
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Memo {
    pub id: String,
    pub project_id: String,
    pub category: String,
    pub title: String,
    /// JSON: { content }
    pub data: String,
    pub sort_order: i64,
}

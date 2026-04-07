use serde::{Deserialize, Serialize};

/// キャラクター（登場人物）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Character {
    pub id: String,
    pub project_id: String,
    pub category: String,
    pub name: String,
    /// JSON: { profile: {...}, tabs: [...], extra_fields: [...] }
    pub data: String,
    pub sort_order: i64,
}

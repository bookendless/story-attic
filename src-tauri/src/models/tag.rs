use serde::{Deserialize, Serialize};

/// タグ（全エンティティ共通・ポリモーフィック設計）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub project_id: String,
    /// エンティティ種別（"character" | "glossary" | "memo" | "material"）
    pub entity_type: String,
    pub entity_id: String,
    pub tag: String,
}

use serde::{Deserialize, Serialize};

/// キャラクター相関図（ダイアグラム単位）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Correlation {
    pub id: String,
    pub project_id: String,
    pub title: String,
    /// JSON: { nodes: [{id, name, characterId}], edges: [{from, to, type, intensity, description, notes}] }
    pub data: String,
}

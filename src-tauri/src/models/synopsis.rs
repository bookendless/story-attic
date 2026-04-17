use serde::{Deserialize, Serialize};

/// あらすじ（プロジェクト1:1）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Synopsis {
    pub id: String,
    pub project_id: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

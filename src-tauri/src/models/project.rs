use serde::{Deserialize, Serialize};

/// ホーム画面のプロジェクトカード用サマリー
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSummary {
    pub id: String,
    pub title: String,
    pub author: String,
    pub description: String,
    pub episode_count: i64,
    pub total_chars: i64,
    pub updated_at: String,
    pub created_at: String,
}

/// プロジェクト詳細（ワークスペース用）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub title: String,
    pub author: String,
    pub description: String,
    pub settings: serde_json::Value,
    pub created_at: String,
    pub updated_at: String,
}

/// プロジェクト更新リクエスト
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectUpdate {
    pub title: Option<String>,
    pub author: Option<String>,
    pub description: Option<String>,
}

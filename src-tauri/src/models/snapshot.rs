use serde::{Deserialize, Serialize};

/// スナップショットの詳細（本文含む）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub id: String,
    pub episode_id: String,
    pub body: String,
    pub char_count: i64,
    pub created_at: String,
}

/// スナップショットのサマリー（本文なし、一覧用）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotSummary {
    pub id: String,
    pub episode_id: String,
    pub char_count: i64,
    pub created_at: String,
}

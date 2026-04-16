use serde::{Deserialize, Serialize};

/// 作品のストレージ使用量統計
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageStats {
    /// DB ファイル全体のサイズ（バイト）
    pub db_size_bytes: u64,
    /// 本文データの合計サイズ（バイト）
    pub episode_body_bytes: i64,
    /// スナップショット本文の合計サイズ（バイト、圧縮済み）
    pub snapshot_bytes: i64,
    /// スナップショット件数
    pub snapshot_count: i64,
    /// エピソード数
    pub episode_count: i64,
}

/// スナップショットの詳細（本文含む）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub id: String,
    pub episode_id: String,
    pub body: String,
    pub char_count: i64,
    pub label: String,
    pub created_at: String,
}

/// スナップショットのサマリー（本文なし、一覧用）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotSummary {
    pub id: String,
    pub episode_id: String,
    pub char_count: i64,
    pub label: String,
    pub created_at: String,
}

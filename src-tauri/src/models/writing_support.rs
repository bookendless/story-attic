use serde::{Deserialize, Serialize};

/// 執筆日記エントリ
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiaryEntry {
    pub project_id: String,
    pub date: String,
    pub char_count: i64,
    pub session_sec: i64,
}

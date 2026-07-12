use serde::{Deserialize, Serialize};

/// AI読者のライブ反応（本文の逐語引用にアンカーされたコメント）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReaderReaction {
    pub id: String,
    pub episode_id: String,
    /// ペルソナID（"light_novel" | "mystery" | "editor" | "romance" | "literary" | "casual"）
    pub persona: String,
    /// 本文からの逐語引用（アンカリング用）。章全体への感想は空文字
    pub quote: String,
    pub comment: String,
    /// "emotion"（感情）| "prediction"（予想）| "concern"（離脱懸念）
    pub kind: String,
    pub created_at: String,
}

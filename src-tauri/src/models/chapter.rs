use serde::{Deserialize, Serialize};

/// 章
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chapter {
    pub id: String,
    pub project_id: String,
    pub title: String,
    /// 章の概要（ASB ParsedChapter.summary 由来）
    pub summary: String,
    /// 中プロット用ノードツリー（JSON: {nodes: ChapterNode[]}）
    pub nodes: String,
    pub sort_order: i64,
    pub created_at: String,
    pub setting: String,
    pub mood: String,
    pub important_events: String,
}

/// 章とエピソードの紐づけ（フロント送信用）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChapterEpisode {
    pub chapter_id: String,
    pub episode_id: String,
    pub sort_order: i64,
}

/// 左パネル用の章ツリー（章 + 所属エピソード一覧）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChapterTree {
    pub chapters: Vec<ChapterWithEpisodes>,
    /// 章未割当のエピソード
    pub ungrouped: Vec<crate::models::EpisodeSummary>,
}

/// 章 + 所属エピソード
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChapterWithEpisodes {
    pub chapter: Chapter,
    pub episodes: Vec<crate::models::EpisodeSummary>,
}

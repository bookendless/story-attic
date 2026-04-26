use serde::{Deserialize, Serialize};

/// AI Story Builder ファイルのパース結果（全セクション統合）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ParsedStoryProject {
    pub title: String,
    pub overview: String,
    pub basic_info: ParsedBasicInfo,
    pub characters: Vec<ParsedCharacter>,
    pub plot: ParsedPlot,
    pub synopsis: String,
    pub chapters: Vec<ParsedChapter>,
    pub drafts: Vec<ParsedDraft>,
    // 任意セクション
    pub glossary: Vec<ParsedGlossaryItem>,
    pub relationships: Vec<ParsedRelationship>,
    pub world_settings: Vec<ParsedWorldSetting>,
    pub plot_threads: Vec<ParsedPlotThread>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ParsedBasicInfo {
    pub genre: String,
    pub sub_genre: String,
    pub target_readers: String,
    pub theme: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedCharacter {
    pub name: String,
    /// 括弧内のメタ情報 e.g. "主人公。29歳。"
    pub meta: String,
    pub appearance: String,
    pub personality: String,
    pub background: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ParsedPlot {
    pub theme: String,
    pub setting: String,
    pub hook: String,
    pub protagonist_goal: String,
    pub main_obstacles: String,
    pub ending: String,
    pub structure_type: String,
    pub phases: Vec<ParsedPlotPhase>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedPlotPhase {
    pub label: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ParsedChapter {
    pub number: i32,
    pub title: String,
    pub summary: String,
    pub setting: String,
    pub mood: String,
    pub important_events: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedDraft {
    /// 章タイトル参照（MDのみ）
    pub chapter_ref: Option<String>,
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedGlossaryItem {
    pub term: String,
    pub reading: String,
    pub term_type: String,
    pub definition: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedRelationship {
    pub from_name: String,
    pub to_name: String,
    pub relation_type: String,
    pub intensity: i32,
    pub description: String,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedWorldSetting {
    pub title: String,
    pub category: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ParsedPlotThread {
    pub title: String,
    pub category: String,
    pub status: String,
    pub importance: String,
    pub description: String,
    pub points: Vec<ParsedPlotThreadPoint>,
    pub related_characters: Vec<String>,
    pub resolution: String,
    pub notes: String,
    pub recommended_placement: String,
    pub expected_effect: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedPlotThreadPoint {
    pub point_type: String,
    pub chapter: String,
    pub content: String,
}

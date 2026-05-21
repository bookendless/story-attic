use crate::AppState;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::State;
use uuid::Uuid;

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

fn parse_json(s: &str) -> serde_json::Value {
    serde_json::from_str(s).unwrap_or_default()
}

fn to_json_str(v: &serde_json::Value) -> String {
    serde_json::to_string(v).unwrap_or_else(|_| "{}".to_string())
}

/// TipTap 由来の HTML 本文を一般的な TXT 形式へ変換する。
///
/// - `<p>` 終端を空行に（段落区切り）
/// - `<br>` を改行に
/// - `<ruby>漢字<rt>かんじ</rt></ruby>` を `|漢字《かんじ》` へ復元
/// - その他タグは除去、主要エンティティをデコード
/// - 3 行以上の連続改行は 2 行に圧縮
fn html_to_plain_text(html: &str) -> String {
    let s = transform_ruby(html);

    // 改行に寄せるブロック系タグを順に置換
    let s = s
        .replace("</p>", "\n\n")
        .replace("<br>", "\n")
        .replace("<br/>", "\n")
        .replace("<br />", "\n")
        .replace("</div>", "\n")
        .replace("</li>", "\n")
        .replace("</h1>", "\n\n")
        .replace("</h2>", "\n\n")
        .replace("</h3>", "\n\n")
        .replace("</h4>", "\n\n")
        .replace("</h5>", "\n\n")
        .replace("</h6>", "\n\n")
        .replace("</blockquote>", "\n\n")
        .replace("<hr>", "\n----\n")
        .replace("<hr/>", "\n----\n")
        .replace("<hr />", "\n----\n");

    // 残余タグを除去
    let mut stripped = String::with_capacity(s.len());
    let mut in_tag = false;
    for c in s.chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => stripped.push(c),
            _ => {}
        }
    }

    let decoded = decode_entities(&stripped);

    // 3 行以上の連続改行を 2 行にまとめる
    let mut collapsed = String::with_capacity(decoded.len());
    let mut run = 0usize;
    for c in decoded.chars() {
        if c == '\n' {
            run += 1;
            if run <= 2 {
                collapsed.push(c);
            }
        } else {
            run = 0;
            collapsed.push(c);
        }
    }

    collapsed.trim().to_string()
}

/// `<ruby>X<rt>Y</rt></ruby>` → `|X《Y》` 記法に戻す
fn transform_ruby(html: &str) -> String {
    let mut out = String::with_capacity(html.len());
    let mut rest = html;
    loop {
        let Some(start) = rest.find("<ruby") else {
            out.push_str(rest);
            break;
        };
        out.push_str(&rest[..start]);
        let after_start = &rest[start..];
        let Some(end_rel) = after_start.find("</ruby>") else {
            out.push_str(after_start);
            break;
        };
        let Some(gt) = after_start.find('>') else {
            out.push_str(after_start);
            break;
        };
        let inner = &after_start[gt + 1..end_rel];
        let (base, ruby_text) = split_ruby_inner(inner);
        if ruby_text.is_empty() {
            out.push_str(&base);
        } else {
            out.push('|');
            out.push_str(&base);
            out.push('《');
            out.push_str(&ruby_text);
            out.push('》');
        }
        rest = &after_start[end_rel + "</ruby>".len()..];
    }
    out
}

fn split_ruby_inner(inner: &str) -> (String, String) {
    let Some(rt_tag) = inner.find("<rt") else {
        return (strip_all_tags(inner), String::new());
    };
    let base = strip_all_tags(&inner[..rt_tag]);
    let after_rt = &inner[rt_tag..];
    let Some(gt) = after_rt.find('>') else {
        return (base, String::new());
    };
    let rt_body = &after_rt[gt + 1..];
    let rt_end = rt_body.find("</rt>").unwrap_or(rt_body.len());
    let ruby_text = strip_all_tags(&rt_body[..rt_end]);
    (base, ruby_text)
}

fn strip_all_tags(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut in_tag = false;
    for c in s.chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(c),
            _ => {}
        }
    }
    out
}

fn decode_entities(s: &str) -> String {
    // &amp; は他のエンティティを二重デコードしないよう最後に処理
    s.replace("&nbsp;", "\u{00A0}")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&amp;", "&")
}

// =============================================================================
// エクスポート/インポート 型定義
// =============================================================================

/// .story-attic.json エクスポート形式（v2.0.0: 全データ対応）
#[derive(Debug, Serialize, Deserialize)]
pub struct StoryAtticExport {
    pub format: String,
    pub version: String,
    pub exported_at: String,
    pub project: ExportProject,
    pub chapters: Vec<ExportChapter>,
    pub chapter_episodes: Vec<ExportChapterEpisode>,
    pub episodes: Vec<ExportEpisode>,
    // v2.0.0 追加フィールド（#[serde(default)] で v1.0.0 ファイルとの後方互換を維持）
    #[serde(default)]
    pub characters: Vec<ExportCharacter>,
    #[serde(default)]
    pub plots: Vec<ExportPlot>,
    #[serde(default)]
    pub plot_structure: Option<ExportPlotStructure>,
    #[serde(default)]
    pub plot_threads: Vec<ExportPlotThread>,
    #[serde(default)]
    pub glossary: Vec<ExportGlossaryItem>,
    #[serde(default)]
    pub memos: Vec<ExportMemo>,
    #[serde(default)]
    pub materials: Vec<ExportMaterial>,
    #[serde(default)]
    pub correlations: Vec<ExportCorrelation>,
    #[serde(default)]
    pub synopsis: Option<ExportSynopsis>,
    #[serde(default)]
    pub timelines: Vec<ExportTimeline>,
    #[serde(default)]
    pub tags: Vec<ExportTag>,
    #[serde(default)]
    pub ai_settings: Option<ExportAiSettings>,
    #[serde(default)]
    pub diary_entries: Vec<ExportDiaryEntry>,
    #[serde(default)]
    pub mindmaps: Vec<ExportMindmap>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportProject {
    pub title: String,
    pub author: String,
    pub description: String,
    pub settings: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportChapter {
    pub id: String,
    pub title: String,
    pub sort_order: i64,
    #[serde(default)]
    pub summary: String,
    #[serde(default)]
    pub nodes: String,
    #[serde(default)]
    pub setting: String,
    #[serde(default)]
    pub mood: String,
    #[serde(default)]
    pub important_events: String,
    #[serde(default)]
    pub five_senses: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportChapterEpisode {
    pub chapter_id: String,
    pub episode_id: String,
    pub sort_order: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportEpisode {
    pub id: String,
    pub title: String,
    pub body: String,
    pub sort_order: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportCharacter {
    pub id: String,
    pub category: String,
    pub name: String,
    pub data: serde_json::Value,
    pub sort_order: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportPlot {
    pub id: String,
    pub title: String,
    pub plot_type: String,
    pub theme: String,
    pub data: serde_json::Value,
    pub sort_order: i64,
    pub is_pinned: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportPlotStructure {
    pub data: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportPlotThread {
    pub id: String,
    pub title: String,
    pub category: String,
    pub data: serde_json::Value,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportGlossaryItem {
    pub id: String,
    pub category: String,
    pub term: String,
    pub data: serde_json::Value,
    pub sort_order: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportMemo {
    pub id: String,
    pub category: String,
    pub title: String,
    pub data: serde_json::Value,
    pub sort_order: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportMaterial {
    pub id: String,
    pub book: String,
    pub category: String,
    pub title: String,
    pub data: serde_json::Value,
    pub sort_order: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportCorrelation {
    pub id: String,
    pub title: String,
    pub data: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportSynopsis {
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportTimeline {
    pub id: String,
    pub chapter_id: Option<String>,
    pub title: String,
    pub data: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportTag {
    pub entity_type: String,
    pub entity_id: String,
    pub tag: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportAiSettings {
    pub provider: String,
    pub model: String,
    pub system_prompt: String,
    pub data: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportDiaryEntry {
    pub date: String,
    pub char_count: i64,
    pub session_sec: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportMindmap {
    pub id: String,
    pub title: String,
    pub data: serde_json::Value,
}

// =============================================================================
// エクスポートコマンド
// =============================================================================

/// プロジェクトの全データを .story-attic.json としてエクスポートする（v2.0.0）
/// 返り値: JSON テキスト（フロント側でファイル保存ダイアログに渡す）
#[tauri::command]
pub fn export_project_json(project_id: String, state: State<AppState>) -> CmdResult<String> {
    let conn = state.db.lock().map_err(err)?;

    // プロジェクト基本情報
    let (title, author, description, settings_str): (String, String, String, String) = conn
        .query_row(
            "SELECT title, author, description, settings FROM projects WHERE id = ?1",
            rusqlite::params![project_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(err)?;
    let settings = parse_json(&settings_str);

    // 章（全フィールド）
    let chapters: Vec<ExportChapter> = conn
        .prepare(
            "SELECT id, title, sort_order,
                    COALESCE(summary, ''), COALESCE(nodes, ''),
                    COALESCE(setting, ''), COALESCE(mood, ''),
                    COALESCE(important_events, ''), COALESCE(five_senses, '')
             FROM chapters WHERE project_id = ?1 ORDER BY sort_order",
        )
        .map_err(err)?
        .query_map(rusqlite::params![project_id], |row| {
            Ok(ExportChapter {
                id: row.get(0)?,
                title: row.get(1)?,
                sort_order: row.get(2)?,
                summary: row.get(3)?,
                nodes: row.get(4)?,
                setting: row.get(5)?,
                mood: row.get(6)?,
                important_events: row.get(7)?,
                five_senses: row.get(8)?,
            })
        })
        .map_err(err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(err)?;

    // 章-エピソード紐づけ
    let chapter_episodes: Vec<ExportChapterEpisode> = conn
        .prepare(
            "SELECT ce.chapter_id, ce.episode_id, ce.sort_order
             FROM chapter_episodes ce
             JOIN episodes e ON e.id = ce.episode_id
             WHERE e.project_id = ?1
             ORDER BY ce.sort_order",
        )
        .map_err(err)?
        .query_map(rusqlite::params![project_id], |row| {
            Ok(ExportChapterEpisode {
                chapter_id: row.get(0)?,
                episode_id: row.get(1)?,
                sort_order: row.get(2)?,
            })
        })
        .map_err(err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(err)?;

    // エピソード
    let episodes: Vec<ExportEpisode> = conn
        .prepare(
            "SELECT id, title, body, sort_order FROM episodes WHERE project_id = ?1 ORDER BY sort_order",
        )
        .map_err(err)?
        .query_map(rusqlite::params![project_id], |row| {
            Ok(ExportEpisode {
                id: row.get(0)?,
                title: row.get(1)?,
                body: row.get(2)?,
                sort_order: row.get(3)?,
            })
        })
        .map_err(err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(err)?;

    // キャラクター
    let characters: Vec<ExportCharacter> = conn
        .prepare(
            "SELECT id, category, name, data, sort_order FROM characters WHERE project_id = ?1 ORDER BY sort_order",
        )
        .map_err(err)?
        .query_map(rusqlite::params![project_id], |row| {
            let data_str: String = row.get(3)?;
            Ok(ExportCharacter {
                id: row.get(0)?,
                category: row.get(1)?,
                name: row.get(2)?,
                data: parse_json(&data_str),
                sort_order: row.get(4)?,
            })
        })
        .map_err(err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(err)?;

    // プロット
    let plots: Vec<ExportPlot> = conn
        .prepare(
            "SELECT id, title, plot_type, theme, data, sort_order, COALESCE(is_pinned, 0)
             FROM plots WHERE project_id = ?1 ORDER BY sort_order",
        )
        .map_err(err)?
        .query_map(rusqlite::params![project_id], |row| {
            let data_str: String = row.get(4)?;
            let is_pinned: i64 = row.get(6)?;
            Ok(ExportPlot {
                id: row.get(0)?,
                title: row.get(1)?,
                plot_type: row.get(2)?,
                theme: row.get(3)?,
                data: parse_json(&data_str),
                sort_order: row.get(5)?,
                is_pinned: is_pinned != 0,
            })
        })
        .map_err(err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(err)?;

    // プロット構造（1:1、存在しない場合は None）
    let plot_structure: Option<ExportPlotStructure> = conn
        .query_row(
            "SELECT data FROM plot_structure WHERE project_id = ?1",
            rusqlite::params![project_id],
            |row| row.get::<_, String>(0),
        )
        .ok()
        .map(|s| ExportPlotStructure { data: parse_json(&s) });

    // 伏線トラッカー
    let plot_threads: Vec<ExportPlotThread> = conn
        .prepare(
            "SELECT id, title, category, data, sort_order, created_at, updated_at
             FROM plot_threads WHERE project_id = ?1 ORDER BY sort_order",
        )
        .map_err(err)?
        .query_map(rusqlite::params![project_id], |row| {
            let data_str: String = row.get(3)?;
            Ok(ExportPlotThread {
                id: row.get(0)?,
                title: row.get(1)?,
                category: row.get(2)?,
                data: parse_json(&data_str),
                sort_order: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(err)?;

    // 用語集
    let glossary: Vec<ExportGlossaryItem> = conn
        .prepare(
            "SELECT id, category, term, data, sort_order FROM glossary WHERE project_id = ?1 ORDER BY sort_order",
        )
        .map_err(err)?
        .query_map(rusqlite::params![project_id], |row| {
            let data_str: String = row.get(3)?;
            Ok(ExportGlossaryItem {
                id: row.get(0)?,
                category: row.get(1)?,
                term: row.get(2)?,
                data: parse_json(&data_str),
                sort_order: row.get(4)?,
            })
        })
        .map_err(err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(err)?;

    // メモ
    let memos: Vec<ExportMemo> = conn
        .prepare(
            "SELECT id, category, title, data, sort_order FROM memos WHERE project_id = ?1 ORDER BY sort_order",
        )
        .map_err(err)?
        .query_map(rusqlite::params![project_id], |row| {
            let data_str: String = row.get(3)?;
            Ok(ExportMemo {
                id: row.get(0)?,
                category: row.get(1)?,
                title: row.get(2)?,
                data: parse_json(&data_str),
                sort_order: row.get(4)?,
            })
        })
        .map_err(err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(err)?;

    // 資料
    let materials: Vec<ExportMaterial> = conn
        .prepare(
            "SELECT id, book, category, title, data, sort_order FROM materials WHERE project_id = ?1 ORDER BY book, category, sort_order",
        )
        .map_err(err)?
        .query_map(rusqlite::params![project_id], |row| {
            let data_str: String = row.get(4)?;
            Ok(ExportMaterial {
                id: row.get(0)?,
                book: row.get(1)?,
                category: row.get(2)?,
                title: row.get(3)?,
                data: parse_json(&data_str),
                sort_order: row.get(5)?,
            })
        })
        .map_err(err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(err)?;

    // 相関図
    let correlations: Vec<ExportCorrelation> = conn
        .prepare("SELECT id, title, data FROM correlations WHERE project_id = ?1")
        .map_err(err)?
        .query_map(rusqlite::params![project_id], |row| {
            let data_str: String = row.get(2)?;
            Ok(ExportCorrelation {
                id: row.get(0)?,
                title: row.get(1)?,
                data: parse_json(&data_str),
            })
        })
        .map_err(err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(err)?;

    // あらすじ（1:1、存在しない場合は None）
    let synopsis: Option<ExportSynopsis> = conn
        .query_row(
            "SELECT content FROM synopses WHERE project_id = ?1",
            rusqlite::params![project_id],
            |row| row.get::<_, String>(0),
        )
        .ok()
        .map(|content| ExportSynopsis { content });

    // タイムライン
    let timelines: Vec<ExportTimeline> = conn
        .prepare(
            "SELECT id, chapter_id, COALESCE(title, ''), data FROM timelines WHERE project_id = ?1",
        )
        .map_err(err)?
        .query_map(rusqlite::params![project_id], |row| {
            let data_str: String = row.get(3)?;
            Ok(ExportTimeline {
                id: row.get(0)?,
                chapter_id: row.get(1)?,
                title: row.get(2)?,
                data: parse_json(&data_str),
            })
        })
        .map_err(err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(err)?;

    // タグ（全エンティティ）
    let tags: Vec<ExportTag> = conn
        .prepare(
            "SELECT entity_type, entity_id, tag FROM tags WHERE project_id = ?1 ORDER BY entity_type, entity_id",
        )
        .map_err(err)?
        .query_map(rusqlite::params![project_id], |row| {
            Ok(ExportTag {
                entity_type: row.get(0)?,
                entity_id: row.get(1)?,
                tag: row.get(2)?,
            })
        })
        .map_err(err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(err)?;

    // AI設定（APIキーは keyring に保存されているため含めない）
    let ai_settings: Option<ExportAiSettings> = conn
        .query_row(
            "SELECT provider, model, system_prompt, data FROM ai_settings WHERE project_id = ?1",
            rusqlite::params![project_id],
            |row| {
                let data_str: String = row.get(3)?;
                Ok(ExportAiSettings {
                    provider: row.get(0)?,
                    model: row.get(1)?,
                    system_prompt: row.get(2)?,
                    data: parse_json(&data_str),
                })
            },
        )
        .ok();

    // 執筆日記
    let diary_entries: Vec<ExportDiaryEntry> = conn
        .prepare(
            "SELECT date, char_count, session_sec FROM diary_entries WHERE project_id = ?1 ORDER BY date",
        )
        .map_err(err)?
        .query_map(rusqlite::params![project_id], |row| {
            Ok(ExportDiaryEntry {
                date: row.get(0)?,
                char_count: row.get(1)?,
                session_sec: row.get(2)?,
            })
        })
        .map_err(err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(err)?;

    // マインドマップ
    let mindmaps: Vec<ExportMindmap> = conn
        .prepare("SELECT id, title, data FROM mindmaps WHERE project_id = ?1")
        .map_err(err)?
        .query_map(rusqlite::params![project_id], |row| {
            let data_str: String = row.get(2)?;
            Ok(ExportMindmap {
                id: row.get(0)?,
                title: row.get(1)?,
                data: parse_json(&data_str),
            })
        })
        .map_err(err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(err)?;

    let export = StoryAtticExport {
        format: "story-attic".to_string(),
        version: "2.0.0".to_string(),
        exported_at: chrono::Utc::now().to_rfc3339(),
        project: ExportProject { title, author, description, settings },
        chapters,
        chapter_episodes,
        episodes,
        characters,
        plots,
        plot_structure,
        plot_threads,
        glossary,
        memos,
        materials,
        correlations,
        synopsis,
        timelines,
        tags,
        ai_settings,
        diary_entries,
        mindmaps,
    };

    serde_json::to_string_pretty(&export).map_err(err)
}

// =============================================================================
// インポートコマンド
// =============================================================================

/// .story-attic.json からプロジェクトを全データ込みでインポートする（v1/v2 両対応）
/// 返り値: 新たに生成されたプロジェクト ID
#[tauri::command]
pub fn import_project_json(json_text: String, state: State<AppState>) -> CmdResult<String> {
    let export: StoryAtticExport = serde_json::from_str(&json_text).map_err(err)?;

    if export.format != "story-attic" {
        return Err("サポートされていないファイル形式です".to_string());
    }

    let conn = state.db.lock().map_err(err)?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute_batch("BEGIN").map_err(err)?;
    match do_import(&conn, &export, &now) {
        Ok(new_project_id) => {
            conn.execute_batch("COMMIT").map_err(err)?;
            Ok(new_project_id)
        }
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(e)
        }
    }
}

fn do_import(
    conn: &rusqlite::Connection,
    export: &StoryAtticExport,
    now: &str,
) -> CmdResult<String> {
    // ---- 1. プロジェクト ----
    let new_project_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO projects (id, title, author, description, settings, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
        rusqlite::params![
            new_project_id,
            export.project.title,
            export.project.author,
            export.project.description,
            to_json_str(&export.project.settings),
            now
        ],
    )
    .map_err(err)?;

    // ID マップ（旧 ID → 新 ID）
    let mut chapter_id_map: HashMap<String, String> = HashMap::new();
    let mut episode_id_map: HashMap<String, String> = HashMap::new();
    let mut character_id_map: HashMap<String, String> = HashMap::new();
    let mut plot_id_map: HashMap<String, String> = HashMap::new();
    let mut plot_thread_id_map: HashMap<String, String> = HashMap::new();
    let mut glossary_id_map: HashMap<String, String> = HashMap::new();
    let mut memo_id_map: HashMap<String, String> = HashMap::new();
    let mut material_id_map: HashMap<String, String> = HashMap::new();
    let mut correlation_id_map: HashMap<String, String> = HashMap::new();
    let mut mindmap_id_map: HashMap<String, String> = HashMap::new();

    // ---- 2. 章 ----
    for ch in &export.chapters {
        let new_id = Uuid::new_v4().to_string();
        chapter_id_map.insert(ch.id.clone(), new_id.clone());
        conn.execute(
            "INSERT INTO chapters (id, project_id, title, summary, nodes, sort_order, setting, mood, important_events, five_senses, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            rusqlite::params![
                new_id, new_project_id, ch.title, ch.summary, ch.nodes,
                ch.sort_order, ch.setting, ch.mood, ch.important_events, ch.five_senses, now
            ],
        )
        .map_err(err)?;
    }

    // ---- 3. エピソード ----
    for ep in &export.episodes {
        let new_id = Uuid::new_v4().to_string();
        episode_id_map.insert(ep.id.clone(), new_id.clone());
        conn.execute(
            "INSERT INTO episodes (id, project_id, title, body, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
            rusqlite::params![new_id, new_project_id, ep.title, ep.body, ep.sort_order, now],
        )
        .map_err(err)?;
    }

    // ---- 4. 章-エピソード紐づけ ----
    for ce in &export.chapter_episodes {
        if let (Some(new_ch_id), Some(new_ep_id)) = (
            chapter_id_map.get(&ce.chapter_id),
            episode_id_map.get(&ce.episode_id),
        ) {
            conn.execute(
                "INSERT INTO chapter_episodes (chapter_id, episode_id, sort_order) VALUES (?1, ?2, ?3)",
                rusqlite::params![new_ch_id, new_ep_id, ce.sort_order],
            )
            .map_err(err)?;
        }
    }

    // ---- 5. キャラクター ----
    for ch in &export.characters {
        let new_id = Uuid::new_v4().to_string();
        character_id_map.insert(ch.id.clone(), new_id.clone());
        conn.execute(
            "INSERT INTO characters (id, project_id, category, name, data, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                new_id, new_project_id, ch.category, ch.name,
                to_json_str(&ch.data), ch.sort_order
            ],
        )
        .map_err(err)?;
    }

    // ---- 6. プロット ----
    for pl in &export.plots {
        let new_id = Uuid::new_v4().to_string();
        plot_id_map.insert(pl.id.clone(), new_id.clone());
        conn.execute(
            "INSERT INTO plots (id, project_id, title, plot_type, theme, data, sort_order, is_pinned)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                new_id, new_project_id, pl.title, pl.plot_type, pl.theme,
                to_json_str(&pl.data), pl.sort_order, pl.is_pinned as i64
            ],
        )
        .map_err(err)?;
    }

    // ---- 7. プロット構造 ----
    if let Some(ps) = &export.plot_structure {
        conn.execute(
            "INSERT INTO plot_structure (project_id, data) VALUES (?1, ?2)",
            rusqlite::params![new_project_id, to_json_str(&ps.data)],
        )
        .map_err(err)?;
    }

    // ---- 8. 伏線トラッカー（data.relatedCharacters を character_id_map でリマップ）----
    for pt in &export.plot_threads {
        let new_id = Uuid::new_v4().to_string();
        plot_thread_id_map.insert(pt.id.clone(), new_id.clone());

        let mut data = pt.data.clone();
        if let Some(arr) = data["relatedCharacters"].as_array_mut() {
            *arr = arr
                .iter()
                .map(|v| {
                    let old_id = v.as_str().unwrap_or("");
                    let new_char_id = character_id_map
                        .get(old_id)
                        .cloned()
                        .unwrap_or_else(|| old_id.to_string());
                    serde_json::Value::String(new_char_id)
                })
                .collect();
        }

        conn.execute(
            "INSERT INTO plot_threads (id, project_id, title, category, data, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                new_id, new_project_id, pt.title, pt.category,
                to_json_str(&data), pt.sort_order, pt.created_at, pt.updated_at
            ],
        )
        .map_err(err)?;
    }

    // ---- 9. 用語集 ----
    for g in &export.glossary {
        let new_id = Uuid::new_v4().to_string();
        glossary_id_map.insert(g.id.clone(), new_id.clone());
        conn.execute(
            "INSERT INTO glossary (id, project_id, category, term, data, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                new_id, new_project_id, g.category, g.term,
                to_json_str(&g.data), g.sort_order
            ],
        )
        .map_err(err)?;
    }

    // ---- 10. メモ ----
    for m in &export.memos {
        let new_id = Uuid::new_v4().to_string();
        memo_id_map.insert(m.id.clone(), new_id.clone());
        conn.execute(
            "INSERT INTO memos (id, project_id, category, title, data, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                new_id, new_project_id, m.category, m.title,
                to_json_str(&m.data), m.sort_order
            ],
        )
        .map_err(err)?;
    }

    // ---- 11. 資料 ----
    for mat in &export.materials {
        let new_id = Uuid::new_v4().to_string();
        material_id_map.insert(mat.id.clone(), new_id.clone());
        conn.execute(
            "INSERT INTO materials (id, project_id, book, category, title, data, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                new_id, new_project_id, mat.book, mat.category, mat.title,
                to_json_str(&mat.data), mat.sort_order
            ],
        )
        .map_err(err)?;
    }

    // ---- 12. 相関図（data.nodes[].characterId を character_id_map でリマップ）----
    for corr in &export.correlations {
        let new_id = Uuid::new_v4().to_string();
        correlation_id_map.insert(corr.id.clone(), new_id.clone());

        let mut data = corr.data.clone();
        if let Some(nodes) = data["nodes"].as_array_mut() {
            for node in nodes.iter_mut() {
                if let Some(old_char_id) = node["characterId"].as_str() {
                    if let Some(new_char_id) = character_id_map.get(old_char_id) {
                        node["characterId"] = serde_json::Value::String(new_char_id.clone());
                    }
                }
            }
        }

        conn.execute(
            "INSERT INTO correlations (id, project_id, title, data) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![new_id, new_project_id, corr.title, to_json_str(&data)],
        )
        .map_err(err)?;
    }

    // ---- 13. あらすじ ----
    if let Some(syn) = &export.synopsis {
        let new_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO synopses (id, project_id, content, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?4)",
            rusqlite::params![new_id, new_project_id, syn.content, now],
        )
        .map_err(err)?;
    }

    // ---- 14. タイムライン（chapter_id を chapter_id_map でリマップ）----
    for tl in &export.timelines {
        let new_id = Uuid::new_v4().to_string();
        let new_chapter_id: Option<String> = tl
            .chapter_id
            .as_deref()
            .and_then(|old| chapter_id_map.get(old))
            .cloned();
        conn.execute(
            "INSERT INTO timelines (id, project_id, chapter_id, title, data)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                new_id, new_project_id, new_chapter_id, tl.title,
                to_json_str(&tl.data)
            ],
        )
        .map_err(err)?;
    }

    // ---- 15. マインドマップ（タグ処理より先に挿入して mindmap_id_map を確立）----
    for mm in &export.mindmaps {
        let new_id = Uuid::new_v4().to_string();
        mindmap_id_map.insert(mm.id.clone(), new_id.clone());
        conn.execute(
            "INSERT INTO mindmaps (id, project_id, title, data) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![new_id, new_project_id, mm.title, to_json_str(&mm.data)],
        )
        .map_err(err)?;
    }

    // ---- 16. タグ（entity_id を entity_type に応じた ID マップでリマップ）----
    for tag in &export.tags {
        let new_entity_id = match tag.entity_type.as_str() {
            "character"   => character_id_map.get(&tag.entity_id),
            "episode"     => episode_id_map.get(&tag.entity_id),
            "plot_thread" => plot_thread_id_map.get(&tag.entity_id),
            "glossary"    => glossary_id_map.get(&tag.entity_id),
            "memo"        => memo_id_map.get(&tag.entity_id),
            "material"    => material_id_map.get(&tag.entity_id),
            "correlation" => correlation_id_map.get(&tag.entity_id),
            "plot"        => plot_id_map.get(&tag.entity_id),
            "mindmap"     => mindmap_id_map.get(&tag.entity_id),
            _             => None,
        };
        if let Some(new_entity_id) = new_entity_id {
            let new_tag_id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT OR IGNORE INTO tags (id, project_id, entity_type, entity_id, tag)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![
                    new_tag_id, new_project_id, tag.entity_type, new_entity_id, tag.tag
                ],
            )
            .map_err(err)?;
        }
    }

    // ---- 17. AI 設定 ----
    if let Some(ai) = &export.ai_settings {
        conn.execute(
            "INSERT INTO ai_settings (project_id, provider, model, system_prompt, data)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                new_project_id, ai.provider, ai.model, ai.system_prompt,
                to_json_str(&ai.data)
            ],
        )
        .map_err(err)?;
    }

    // ---- 18. 執筆日記 ----
    for de in &export.diary_entries {
        conn.execute(
            "INSERT OR IGNORE INTO diary_entries (project_id, date, char_count, session_sec)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![new_project_id, de.date, de.char_count, de.session_sec],
        )
        .map_err(err)?;
    }

    Ok(new_project_id)
}

// =============================================================================
// テキスト/ZIP エクスポート・テキストインポート（既存機能）
// =============================================================================

/// 指定エピソードをテキストファイルとしてエクスポートする
/// 返り値: テキスト内容（フロント側でファイル保存ダイアログに渡す）
#[tauri::command]
pub fn export_episodes_txt(
    project_id: String,
    episode_ids: Vec<String>,
    state: State<AppState>,
) -> CmdResult<String> {
    let conn = state.db.lock().map_err(err)?;
    let mut parts = Vec::new();

    for id in &episode_ids {
        let result: rusqlite::Result<(String, String)> = conn.query_row(
            "SELECT title, body FROM episodes WHERE id = ?1 AND project_id = ?2",
            rusqlite::params![id, project_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        );
        if let Ok((title, body)) = result {
            let text = html_to_plain_text(&body);
            parts.push(format!("【{}】\n\n{}", title, text));
        }
    }

    Ok(parts.join("\n\n----------\n\n"))
}

/// 全エピソードをZIPアーカイブにまとめてエクスポートする
/// 返り値: ZIPファイルのバイト列（Base64エンコード）
#[tauri::command]
pub fn export_episodes_zip(project_id: String, state: State<AppState>) -> CmdResult<String> {
    use std::io::Write;

    let conn = state.db.lock().map_err(err)?;

    let mut stmt = conn
        .prepare(
            "SELECT title, body FROM episodes WHERE project_id = ?1 ORDER BY sort_order",
        )
        .map_err(err)?;

    let episodes: Vec<(String, String)> = stmt
        .query_map(rusqlite::params![project_id], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .map_err(err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(err)?;

    let mut buf = Vec::new();
    {
        let mut zip = zip::ZipWriter::new(std::io::Cursor::new(&mut buf));
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        for (i, (title, body)) in episodes.iter().enumerate() {
            // ファイル名に使えない文字を置換
            let safe_title: String = title
                .chars()
                .map(|c| match c {
                    '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
                    _ => c,
                })
                .collect();
            let filename = format!("{:03}_{}.txt", i + 1, safe_title);
            let text = html_to_plain_text(body);
            let content = format!("【{}】\n\n{}", title, text);
            zip.start_file(filename, options).map_err(err)?;
            zip.write_all(content.as_bytes()).map_err(err)?;
        }
        zip.finish().map_err(err)?;
    }

    // フロント側でUint8Arrayに変換できるよう16進数文字列で返す
    let hex = buf.iter().map(|b| format!("{:02x}", b)).collect::<String>();
    Ok(hex)
}

/// テキストファイル群をエピソードとしてインポートする
/// 返り値: 作成されたエピソードIDのリスト
#[tauri::command]
pub fn import_txt_files(
    project_id: String,
    files: Vec<TxtFileInput>,
    state: State<AppState>,
) -> CmdResult<Vec<String>> {
    let conn = state.db.lock().map_err(err)?;
    let now = chrono::Utc::now().to_rfc3339();
    let mut ids = Vec::new();

    let max_order: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM episodes WHERE project_id = ?1",
            rusqlite::params![project_id],
            |row| row.get(0),
        )
        .unwrap_or(-1);

    for (i, file) in files.iter().enumerate() {
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO episodes (id, project_id, title, body, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
            rusqlite::params![
                id,
                project_id,
                file.name,
                file.content,
                max_order + 1 + i as i64,
                now
            ],
        )
        .map_err(err)?;
        ids.push(id);
    }

    Ok(ids)
}

/// テキストファイル入力
#[derive(Debug, Deserialize)]
pub struct TxtFileInput {
    pub name: String,
    pub content: String,
}

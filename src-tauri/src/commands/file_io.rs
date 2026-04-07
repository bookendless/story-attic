use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// .story-attic.json エクスポート形式
#[derive(Debug, Serialize, Deserialize)]
pub struct StoryAtticExport {
    pub format: String,
    pub version: String,
    pub exported_at: String,
    pub project: ExportProject,
    pub chapters: Vec<ExportChapter>,
    pub chapter_episodes: Vec<ExportChapterEpisode>,
    pub episodes: Vec<ExportEpisode>,
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

/// プロジェクトを .story-attic.json としてエクスポートする
/// 返り値: JSONテキスト（フロント側でファイル保存ダイアログに渡す）
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

    let settings: serde_json::Value =
        serde_json::from_str(&settings_str).unwrap_or(serde_json::Value::Object(Default::default()));

    // 章
    let chapters: Vec<ExportChapter> = conn
        .prepare(
            "SELECT id, title, sort_order FROM chapters WHERE project_id = ?1 ORDER BY sort_order",
        )
        .map_err(err)?
        .query_map(rusqlite::params![project_id], |row| {
            Ok(ExportChapter {
                id: row.get(0)?,
                title: row.get(1)?,
                sort_order: row.get(2)?,
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

    let export = StoryAtticExport {
        format: "story-attic".to_string(),
        version: "1.0.0".to_string(),
        exported_at: chrono::Utc::now().to_rfc3339(),
        project: ExportProject {
            title,
            author,
            description,
            settings,
        },
        chapters,
        chapter_episodes,
        episodes,
    };

    serde_json::to_string_pretty(&export).map_err(err)
}

/// .story-attic.json からプロジェクトをインポートする
/// 返り値: 新たに生成されたプロジェクトID
#[tauri::command]
pub fn import_project_json(json_text: String, state: State<AppState>) -> CmdResult<String> {
    let export: StoryAtticExport = serde_json::from_str(&json_text).map_err(err)?;

    if export.format != "story-attic" {
        return Err("サポートされていないファイル形式です".to_string());
    }

    let conn = state.db.lock().map_err(err)?;
    let now = chrono::Utc::now().to_rfc3339();

    // プロジェクト新規作成（IDは新規発行）
    let new_project_id = Uuid::new_v4().to_string();
    let settings_str = serde_json::to_string(&export.project.settings).map_err(err)?;
    conn.execute(
        "INSERT INTO projects (id, title, author, description, settings, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
        rusqlite::params![
            new_project_id,
            export.project.title,
            export.project.author,
            export.project.description,
            settings_str,
            now
        ],
    )
    .map_err(err)?;

    // 旧ID → 新IDのマッピング
    let mut chapter_id_map = std::collections::HashMap::new();
    let mut episode_id_map = std::collections::HashMap::new();

    // 章のインポート
    for ch in &export.chapters {
        let new_id = Uuid::new_v4().to_string();
        chapter_id_map.insert(ch.id.clone(), new_id.clone());
        conn.execute(
            "INSERT INTO chapters (id, project_id, title, sort_order, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![new_id, new_project_id, ch.title, ch.sort_order, now],
        )
        .map_err(err)?;
    }

    // エピソードのインポート
    for ep in &export.episodes {
        let new_id = Uuid::new_v4().to_string();
        episode_id_map.insert(ep.id.clone(), new_id.clone());
        conn.execute(
            "INSERT INTO episodes (id, project_id, title, body, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
            rusqlite::params![
                new_id,
                new_project_id,
                ep.title,
                ep.body,
                ep.sort_order,
                now
            ],
        )
        .map_err(err)?;
    }

    // 章-エピソード紐づけのインポート
    for ce in &export.chapter_episodes {
        if let (Some(new_ch_id), Some(new_ep_id)) = (
            chapter_id_map.get(&ce.chapter_id),
            episode_id_map.get(&ce.episode_id),
        ) {
            conn.execute(
                "INSERT INTO chapter_episodes (chapter_id, episode_id, sort_order)
                 VALUES (?1, ?2, ?3)",
                rusqlite::params![new_ch_id, new_ep_id, ce.sort_order],
            )
            .map_err(err)?;
        }
    }

    Ok(new_project_id)
}

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
            parts.push(format!("【{}】\n\n{}", title, body));
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
            zip.start_file(filename, options).map_err(err)?;
            zip.write_all(body.as_bytes()).map_err(err)?;
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

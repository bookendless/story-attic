use crate::models::{Episode, EpisodeSummary};
use crate::AppState;
use tauri::State;
use uuid::Uuid;

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// エピソードを新規作成する
#[tauri::command]
pub fn create_episode(
    project_id: String,
    title: String,
    state: State<AppState>,
) -> CmdResult<String> {
    let conn = state.db.lock().map_err(err)?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    // 現在の最大sort_orderを取得して末尾に追加
    let max_order: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM episodes WHERE project_id = ?1",
            rusqlite::params![project_id],
            |row| row.get(0),
        )
        .unwrap_or(-1);

    conn.execute(
        "INSERT INTO episodes (id, project_id, title, body, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, '', ?4, ?5, ?5)",
        rusqlite::params![id, project_id, title, max_order + 1, now],
    )
    .map_err(err)?;

    Ok(id)
}

/// エピソードの本文を含む詳細を返す
#[tauri::command]
pub fn get_episode(id: String, state: State<AppState>) -> CmdResult<Episode> {
    let conn = state.db.lock().map_err(err)?;

    conn.query_row(
        "SELECT id, project_id, title, body, sort_order, text_char_count(body), created_at, updated_at
         FROM episodes WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(Episode {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                body: row.get(3)?,
                sort_order: row.get(4)?,
                char_count: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        },
    )
    .map_err(err)
}

/// エピソードのサマリー一覧（本文なし）を返す
#[tauri::command]
pub fn list_episodes(project_id: String, state: State<AppState>) -> CmdResult<Vec<EpisodeSummary>> {
    let conn = state.db.lock().map_err(err)?;

    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, title, sort_order, text_char_count(body), updated_at
             FROM episodes WHERE project_id = ?1 ORDER BY sort_order ASC",
        )
        .map_err(err)?;

    let rows = stmt
        .query_map(rusqlite::params![project_id], |row| {
            Ok(EpisodeSummary {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                sort_order: row.get(3)?,
                char_count: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(err)?;

    rows.collect::<Result<Vec<_>, _>>().map_err(err)
}

/// エピソードの本文を保存する
#[tauri::command]
pub fn save_episode(id: String, body: String, state: State<AppState>) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE episodes SET body = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![body, now, id],
    )
    .map_err(err)?;

    // プロジェクトのupdated_atも更新
    conn.execute(
        "UPDATE projects SET updated_at = ?1
         WHERE id = (SELECT project_id FROM episodes WHERE id = ?2)",
        rusqlite::params![now, id],
    )
    .map_err(err)?;

    Ok(())
}

/// エピソードのタイトルを変更する
#[tauri::command]
pub fn rename_episode(id: String, title: String, state: State<AppState>) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE episodes SET title = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![title, now, id],
    )
    .map_err(err)?;
    Ok(())
}

/// エピソードを削除する
#[tauri::command]
pub fn delete_episode(id: String, state: State<AppState>) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute("DELETE FROM episodes WHERE id = ?1", rusqlite::params![id])
        .map_err(err)?;
    Ok(())
}

/// エピソードのsort_orderを更新する（D&D後に呼ぶ）
#[tauri::command]
pub fn reorder_episodes(
    project_id: String,
    ordered_ids: Vec<String>,
    state: State<AppState>,
) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    for (i, id) in ordered_ids.iter().enumerate() {
        conn.execute(
            "UPDATE episodes SET sort_order = ?1 WHERE id = ?2 AND project_id = ?3",
            rusqlite::params![i as i64, id, project_id],
        )
        .map_err(err)?;
    }
    Ok(())
}

/// プロジェクト内の全エピソード本文を結合して返す（作品全体分析用）
#[tauri::command]
pub fn get_project_full_text(
    project_id: String,
    state: State<AppState>,
) -> CmdResult<String> {
    let conn = state.db.lock().map_err(err)?;
    let mut stmt = conn
        .prepare(
            "SELECT body FROM episodes WHERE project_id = ?1 ORDER BY sort_order ASC",
        )
        .map_err(err)?;
    let bodies: Vec<String> = stmt
        .query_map(rusqlite::params![project_id], |row| row.get(0))
        .map_err(err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(err)?;
    Ok(bodies.join("\n\n"))
}

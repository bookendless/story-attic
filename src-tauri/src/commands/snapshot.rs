use crate::models::{Snapshot, SnapshotSummary};
use crate::AppState;
use tauri::State;
use uuid::Uuid;

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// 現在のエピソード本文からスナップショットを作成する
#[tauri::command]
pub fn save_snapshot(episode_id: String, state: State<AppState>) -> CmdResult<SnapshotSummary> {
    let conn = state.db.lock().map_err(err)?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    // エピソードの現在の本文を取得
    let body: String = conn
        .query_row(
            "SELECT body FROM episodes WHERE id = ?1",
            rusqlite::params![episode_id],
            |row| row.get(0),
        )
        .map_err(err)?;

    // HTMLタグを除去した文字数
    let char_count = strip_html_len(&body);

    conn.execute(
        "INSERT INTO history_snapshots (id, episode_id, body, char_count, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![id, episode_id, body, char_count as i64, now],
    )
    .map_err(err)?;

    Ok(SnapshotSummary {
        id,
        episode_id,
        char_count: char_count as i64,
        created_at: now,
    })
}

/// エピソードのスナップショット一覧を返す（新しい順）
#[tauri::command]
pub fn list_snapshots(
    episode_id: String,
    state: State<AppState>,
) -> CmdResult<Vec<SnapshotSummary>> {
    let conn = state.db.lock().map_err(err)?;

    let mut stmt = conn
        .prepare(
            "SELECT id, episode_id, char_count, created_at
             FROM history_snapshots
             WHERE episode_id = ?1
             ORDER BY created_at DESC",
        )
        .map_err(err)?;

    let rows = stmt
        .query_map(rusqlite::params![episode_id], |row| {
            Ok(SnapshotSummary {
                id: row.get(0)?,
                episode_id: row.get(1)?,
                char_count: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(err)?;

    rows.collect::<Result<Vec<_>, _>>().map_err(err)
}

/// スナップショットの詳細（本文含む）を返す
#[tauri::command]
pub fn get_snapshot(id: String, state: State<AppState>) -> CmdResult<Snapshot> {
    let conn = state.db.lock().map_err(err)?;

    conn.query_row(
        "SELECT id, episode_id, body, char_count, created_at
         FROM history_snapshots WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(Snapshot {
                id: row.get(0)?,
                episode_id: row.get(1)?,
                body: row.get(2)?,
                char_count: row.get(3)?,
                created_at: row.get(4)?,
            })
        },
    )
    .map_err(err)
}

/// スナップショットを削除する
#[tauri::command]
pub fn delete_snapshot(id: String, state: State<AppState>) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute(
        "DELETE FROM history_snapshots WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(err)?;
    Ok(())
}

/// HTMLタグを除去した文字数を返す
fn strip_html_len(html: &str) -> usize {
    let mut count = 0;
    let mut in_tag = false;
    for ch in html.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => count += 1,
            _ => {}
        }
    }
    count
}

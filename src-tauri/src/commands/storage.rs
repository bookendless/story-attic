use crate::models::StorageStats;
use crate::AppState;
use tauri::{Manager, State};

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// 作品のストレージ使用量統計を返す
#[tauri::command]
pub fn get_storage_stats(
    project_id: String,
    app: tauri::AppHandle,
    state: State<AppState>,
) -> CmdResult<StorageStats> {
    // DB ファイルサイズを取得
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(err)?
        .join("story-attic.db");
    let db_size_bytes = std::fs::metadata(&db_path)
        .map(|m| m.len())
        .unwrap_or(0);

    let conn = state.db.lock().map_err(err)?;

    // 本文データの合計サイズ（バイト）
    let episode_body_bytes: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(LENGTH(body)), 0) FROM episodes WHERE project_id = ?1",
            rusqlite::params![project_id],
            |row| row.get(0),
        )
        .map_err(err)?;

    // スナップショット本文の合計サイズ（バイト）とスナップショット件数
    let (snapshot_bytes, snapshot_count): (i64, i64) = conn
        .query_row(
            "SELECT COALESCE(SUM(LENGTH(body)), 0), COUNT(*)
             FROM history_snapshots
             WHERE episode_id IN (SELECT id FROM episodes WHERE project_id = ?1)",
            rusqlite::params![project_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(err)?;

    // エピソード数
    let episode_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM episodes WHERE project_id = ?1",
            rusqlite::params![project_id],
            |row| row.get(0),
        )
        .map_err(err)?;

    Ok(StorageStats {
        db_size_bytes,
        episode_body_bytes,
        snapshot_bytes,
        snapshot_count,
        episode_count,
    })
}

/// 作品の全スナップショットを削除する
#[tauri::command]
pub fn delete_all_snapshots(project_id: String, state: State<AppState>) -> CmdResult<i64> {
    let conn = state.db.lock().map_err(err)?;
    let deleted = conn
        .execute(
            "DELETE FROM history_snapshots
             WHERE episode_id IN (SELECT id FROM episodes WHERE project_id = ?1)",
            rusqlite::params![project_id],
        )
        .map_err(err)? as i64;
    Ok(deleted)
}

/// 各エピソードの古いスナップショットを整理し、最新 keep_count 件のみ残す
#[tauri::command]
pub fn trim_snapshots(
    project_id: String,
    keep_count: i64,
    state: State<AppState>,
) -> CmdResult<i64> {
    let conn = state.db.lock().map_err(err)?;

    // 対象エピソードIDを取得
    let episode_ids: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT id FROM episodes WHERE project_id = ?1")
            .map_err(err)?;
        let rows = stmt
            .query_map(rusqlite::params![project_id], |row| row.get(0))
            .map_err(err)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(err)?;
        rows
    };

    let mut total_deleted: i64 = 0;
    for episode_id in &episode_ids {
        let deleted = conn
            .execute(
                "DELETE FROM history_snapshots
                 WHERE episode_id = ?1
                   AND id NOT IN (
                       SELECT id FROM history_snapshots
                       WHERE episode_id = ?1
                       ORDER BY created_at DESC
                       LIMIT ?2
                   )",
                rusqlite::params![episode_id, keep_count],
            )
            .map_err(err)? as i64;
        total_deleted += deleted;
    }

    Ok(total_deleted)
}

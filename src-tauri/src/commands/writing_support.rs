use crate::models::DiaryEntry;
use crate::AppState;
use tauri::State;

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// 執筆日記エントリを保存する（INSERT OR REPLACE — 同日は上書き更新）
#[tauri::command]
pub fn save_diary_entry(
    project_id: String,
    date: String,
    char_count: i64,
    session_sec: i64,
    state: State<AppState>,
) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute(
        "INSERT OR REPLACE INTO diary_entries (project_id, date, char_count, session_sec)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![project_id, date, char_count, session_sec],
    )
    .map_err(err)?;
    Ok(())
}

/// 執筆セッション秒数を累積加算する（同日は session_sec を加算、char_count は上書き）
#[tauri::command]
pub fn append_diary_session(
    project_id: String,
    date: String,
    char_count: i64,
    delta_sec: i64,
    state: State<AppState>,
) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute(
        "INSERT INTO diary_entries (project_id, date, char_count, session_sec)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(project_id, date) DO UPDATE SET
           char_count = excluded.char_count,
           session_sec = session_sec + excluded.session_sec",
        rusqlite::params![project_id, date, char_count, delta_sec],
    )
    .map_err(err)?;
    Ok(())
}

/// プロジェクトの全日記エントリを取得する
#[tauri::command]
pub fn get_diary_entries(project_id: String, state: State<AppState>) -> CmdResult<Vec<DiaryEntry>> {
    let conn = state.db.lock().map_err(err)?;
    let mut stmt = conn
        .prepare(
            "SELECT project_id, date, char_count, session_sec
             FROM diary_entries WHERE project_id = ?1 ORDER BY date",
        )
        .map_err(err)?;

    let rows = stmt
        .query_map(rusqlite::params![project_id], |row| {
            Ok(DiaryEntry {
                project_id: row.get(0)?,
                date: row.get(1)?,
                char_count: row.get(2)?,
                session_sec: row.get(3)?,
            })
        })
        .map_err(err)?;

    let mut items = Vec::new();
    for r in rows {
        items.push(r.map_err(err)?);
    }
    Ok(items)
}

/// 日付範囲で日記エントリを取得する
#[tauri::command]
pub fn get_diary_entries_range(
    project_id: String,
    from_date: String,
    to_date: String,
    state: State<AppState>,
) -> CmdResult<Vec<DiaryEntry>> {
    let conn = state.db.lock().map_err(err)?;
    let mut stmt = conn
        .prepare(
            "SELECT project_id, date, char_count, session_sec
             FROM diary_entries
             WHERE project_id = ?1 AND date >= ?2 AND date <= ?3
             ORDER BY date",
        )
        .map_err(err)?;

    let rows = stmt
        .query_map(rusqlite::params![project_id, from_date, to_date], |row| {
            Ok(DiaryEntry {
                project_id: row.get(0)?,
                date: row.get(1)?,
                char_count: row.get(2)?,
                session_sec: row.get(3)?,
            })
        })
        .map_err(err)?;

    let mut items = Vec::new();
    for r in rows {
        items.push(r.map_err(err)?);
    }
    Ok(items)
}

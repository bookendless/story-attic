use crate::models::PlotThread;
use crate::AppState;
use tauri::State;
use uuid::Uuid;

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// 伏線エントリを新規作成する
#[tauri::command]
pub fn create_plot_thread(
    project_id: String,
    title: String,
    category: String,
    data: String,
    state: State<AppState>,
) -> CmdResult<String> {
    let conn = state.db.lock().map_err(err)?;
    let id = Uuid::new_v4().to_string();

    let max_order: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM plot_threads WHERE project_id = ?1",
            rusqlite::params![project_id],
            |row| row.get(0),
        )
        .unwrap_or(-1);

    conn.execute(
        "INSERT INTO plot_threads (id, project_id, title, category, data, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'), datetime('now'))",
        rusqlite::params![id, project_id, title, category, data, max_order + 1],
    )
    .map_err(err)?;

    Ok(id)
}

/// プロジェクトの全伏線エントリを取得する
#[tauri::command]
pub fn get_plot_threads(
    project_id: String,
    state: State<AppState>,
) -> CmdResult<Vec<PlotThread>> {
    let conn = state.db.lock().map_err(err)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, title, category, data, sort_order, created_at, updated_at
             FROM plot_threads WHERE project_id = ?1 ORDER BY sort_order",
        )
        .map_err(err)?;

    let rows = stmt
        .query_map(rusqlite::params![project_id], |row| {
            Ok(PlotThread {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                category: row.get(3)?,
                data: row.get(4)?,
                sort_order: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(err)?;

    let mut items = Vec::new();
    for r in rows {
        items.push(r.map_err(err)?);
    }
    Ok(items)
}

/// 伏線エントリを更新する
#[tauri::command]
pub fn update_plot_thread(
    id: String,
    title: String,
    category: String,
    data: String,
    state: State<AppState>,
) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute(
        "UPDATE plot_threads SET title = ?1, category = ?2, data = ?3, updated_at = datetime('now')
         WHERE id = ?4",
        rusqlite::params![title, category, data, id],
    )
    .map_err(err)?;
    Ok(())
}

/// 伏線エントリを削除する
#[tauri::command]
pub fn delete_plot_thread(id: String, state: State<AppState>) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute(
        "DELETE FROM plot_threads WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(err)?;
    Ok(())
}

/// 伏線エントリの並び順を更新する
#[tauri::command]
pub fn reorder_plot_threads(
    project_id: String,
    ordered_ids: Vec<String>,
    state: State<AppState>,
) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    for (i, tid) in ordered_ids.iter().enumerate() {
        conn.execute(
            "UPDATE plot_threads SET sort_order = ?1 WHERE id = ?2 AND project_id = ?3",
            rusqlite::params![i as i64, tid, project_id],
        )
        .map_err(err)?;
    }
    Ok(())
}

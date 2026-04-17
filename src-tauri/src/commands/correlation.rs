use crate::models::Correlation;
use crate::AppState;
use tauri::State;
use uuid::Uuid;

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// 相関図を新規作成する
#[tauri::command]
pub fn create_correlation(
    project_id: String,
    title: String,
    data: String,
    state: State<AppState>,
) -> CmdResult<String> {
    let conn = state.db.lock().map_err(err)?;
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO correlations (id, project_id, title, data) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, project_id, title, data],
    )
    .map_err(err)?;
    Ok(id)
}

/// プロジェクトの全相関図を取得する
#[tauri::command]
pub fn get_correlations(
    project_id: String,
    state: State<AppState>,
) -> CmdResult<Vec<Correlation>> {
    let conn = state.db.lock().map_err(err)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, title, data
             FROM correlations WHERE project_id = ?1",
        )
        .map_err(err)?;

    let rows = stmt
        .query_map(rusqlite::params![project_id], |row| {
            Ok(Correlation {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                data: row.get(3)?,
            })
        })
        .map_err(err)?;

    let mut items = Vec::new();
    for r in rows {
        items.push(r.map_err(err)?);
    }
    Ok(items)
}

/// 相関図を更新する
#[tauri::command]
pub fn update_correlation(
    id: String,
    title: String,
    data: String,
    state: State<AppState>,
) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute(
        "UPDATE correlations SET title = ?1, data = ?2 WHERE id = ?3",
        rusqlite::params![title, data, id],
    )
    .map_err(err)?;
    Ok(())
}

/// 相関図を削除する
#[tauri::command]
pub fn delete_correlation(id: String, state: State<AppState>) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute(
        "DELETE FROM correlations WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(err)?;
    Ok(())
}

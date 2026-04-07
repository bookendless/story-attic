use crate::models::Settings;
use crate::AppState;
use tauri::State;

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// プロジェクトの設定を取得する
#[tauri::command]
pub fn get_settings(project_id: String, state: State<AppState>) -> CmdResult<Settings> {
    let conn = state.db.lock().map_err(err)?;

    let result: rusqlite::Result<String> = conn.query_row(
        "SELECT settings FROM projects WHERE id = ?1",
        rusqlite::params![project_id],
        |row| row.get(0),
    );

    match result {
        Ok(json) => serde_json::from_str(&json).unwrap_or_else(|_| Ok(Settings::default())),
        Err(_) => Ok(Settings::default()),
    }
}

/// プロジェクトの設定を保存する
#[tauri::command]
pub fn save_settings(
    project_id: String,
    settings: Settings,
    state: State<AppState>,
) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    let json = serde_json::to_string(&settings).map_err(err)?;
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE projects SET settings = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![json, now, project_id],
    )
    .map_err(err)?;
    Ok(())
}

use crate::models::Synopsis;
use crate::AppState;
use tauri::State;
use uuid::Uuid;

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// プロジェクトのあらすじを取得する
#[tauri::command]
pub fn get_synopsis(project_id: String, state: State<AppState>) -> CmdResult<Option<Synopsis>> {
    let conn = state.db.lock().map_err(err)?;
    let result = conn.query_row(
        "SELECT id, project_id, content, created_at, updated_at
         FROM synopses WHERE project_id = ?1",
        rusqlite::params![project_id],
        |row| {
            Ok(Synopsis {
                id: row.get(0)?,
                project_id: row.get(1)?,
                content: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        },
    );

    match result {
        Ok(s) => Ok(Some(s)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(err(e)),
    }
}

/// あらすじを保存する（存在しなければ作成、あれば更新）
#[tauri::command]
pub fn save_synopsis(
    project_id: String,
    content: String,
    state: State<AppState>,
) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO synopses (id, project_id, content, created_at, updated_at)
         VALUES (?1, ?2, ?3, datetime('now'), datetime('now'))
         ON CONFLICT(project_id) DO UPDATE SET
             content = excluded.content,
             updated_at = datetime('now')",
        rusqlite::params![id, project_id, content],
    )
    .map_err(err)?;
    Ok(())
}

use crate::models::{Project, ProjectSummary, ProjectUpdate};
use crate::AppState;
use tauri::State;
use uuid::Uuid;

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// プロジェクトを新規作成する
#[tauri::command]
pub fn create_project(title: String, state: State<AppState>) -> CmdResult<String> {
    let conn = state.db.lock().map_err(err)?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO projects (id, title, author, description, settings, created_at, updated_at)
         VALUES (?1, ?2, '', '', '{}', ?3, ?3)",
        rusqlite::params![id, title, now],
    )
    .map_err(err)?;

    Ok(id)
}

/// プロジェクト一覧を返す（ホーム画面用サマリー）
#[tauri::command]
pub fn list_projects(state: State<AppState>) -> CmdResult<Vec<ProjectSummary>> {
    let conn = state.db.lock().map_err(err)?;

    let mut stmt = conn
        .prepare(
            "SELECT
               p.id,
               p.title,
               p.author,
               p.description,
               p.updated_at,
               p.created_at,
               COUNT(e.id) AS episode_count,
               COALESCE(SUM(LENGTH(e.body)), 0) AS total_chars
             FROM projects p
             LEFT JOIN episodes e ON e.project_id = p.id
             GROUP BY p.id
             ORDER BY p.updated_at DESC",
        )
        .map_err(err)?;

    let rows = stmt
        .query_map([], |row| {
            Ok(ProjectSummary {
                id: row.get(0)?,
                title: row.get(1)?,
                author: row.get(2)?,
                description: row.get(3)?,
                updated_at: row.get(4)?,
                created_at: row.get(5)?,
                episode_count: row.get(6)?,
                total_chars: row.get(7)?,
            })
        })
        .map_err(err)?;

    rows.collect::<Result<Vec<_>, _>>().map_err(err)
}

/// プロジェクト詳細を返す
#[tauri::command]
pub fn get_project(id: String, state: State<AppState>) -> CmdResult<Project> {
    let conn = state.db.lock().map_err(err)?;

    conn.query_row(
        "SELECT id, title, author, description, settings, created_at, updated_at
         FROM projects WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            let settings_str: String = row.get(4)?;
            Ok(Project {
                id: row.get(0)?,
                title: row.get(1)?,
                author: row.get(2)?,
                description: row.get(3)?,
                settings: serde_json::from_str(&settings_str)
                    .unwrap_or(serde_json::Value::Object(Default::default())),
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        },
    )
    .map_err(err)
}

/// プロジェクト情報を更新する
#[tauri::command]
pub fn update_project(
    id: String,
    data: ProjectUpdate,
    state: State<AppState>,
) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    let now = chrono::Utc::now().to_rfc3339();

    if let Some(title) = data.title {
        conn.execute(
            "UPDATE projects SET title = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![title, now, id],
        )
        .map_err(err)?;
    }
    if let Some(author) = data.author {
        conn.execute(
            "UPDATE projects SET author = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![author, now, id],
        )
        .map_err(err)?;
    }
    if let Some(description) = data.description {
        conn.execute(
            "UPDATE projects SET description = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![description, now, id],
        )
        .map_err(err)?;
    }

    Ok(())
}

/// プロジェクトを削除する（CASCADE で関連データも削除）
#[tauri::command]
pub fn delete_project(id: String, state: State<AppState>) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute("DELETE FROM projects WHERE id = ?1", rusqlite::params![id])
        .map_err(err)?;
    Ok(())
}

use crate::commands::tag::delete_tags_for_entity;
use crate::models::Memo;
use crate::AppState;
use tauri::State;
use uuid::Uuid;

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// メモを新規作成する
#[tauri::command]
pub fn create_memo(
    project_id: String,
    title: String,
    category: String,
    state: State<AppState>,
) -> CmdResult<String> {
    let conn = state.db.lock().map_err(err)?;
    let id = Uuid::new_v4().to_string();

    let max_order: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM memos WHERE project_id = ?1",
            rusqlite::params![project_id],
            |row| row.get(0),
        )
        .unwrap_or(-1);

    conn.execute(
        "INSERT INTO memos (id, project_id, category, title, data, sort_order)
         VALUES (?1, ?2, ?3, ?4, '{}', ?5)",
        rusqlite::params![id, project_id, category, title, max_order + 1],
    )
    .map_err(err)?;

    Ok(id)
}

/// プロジェクトの全メモを取得する
#[tauri::command]
pub fn get_memos(project_id: String, state: State<AppState>) -> CmdResult<Vec<Memo>> {
    let conn = state.db.lock().map_err(err)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, category, title, data, sort_order
             FROM memos WHERE project_id = ?1 ORDER BY sort_order",
        )
        .map_err(err)?;

    let rows = stmt
        .query_map(rusqlite::params![project_id], |row| {
            Ok(Memo {
                id: row.get(0)?,
                project_id: row.get(1)?,
                category: row.get(2)?,
                title: row.get(3)?,
                data: row.get(4)?,
                sort_order: row.get(5)?,
            })
        })
        .map_err(err)?;

    let mut items = Vec::new();
    for r in rows {
        items.push(r.map_err(err)?);
    }
    Ok(items)
}

/// メモを更新する
#[tauri::command]
pub fn update_memo(
    id: String,
    title: String,
    category: String,
    data: String,
    state: State<AppState>,
) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute(
        "UPDATE memos SET title = ?1, category = ?2, data = ?3 WHERE id = ?4",
        rusqlite::params![title, category, data, id],
    )
    .map_err(err)?;
    Ok(())
}

/// メモを削除する（タグ連動削除含む）
#[tauri::command]
pub fn delete_memo(id: String, state: State<AppState>) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    delete_tags_for_entity(&conn, "memo", &id)?;
    conn.execute("DELETE FROM memos WHERE id = ?1", rusqlite::params![id])
        .map_err(err)?;
    Ok(())
}

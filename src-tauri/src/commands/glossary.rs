use crate::commands::tag::delete_tags_for_entity;
use crate::models::GlossaryItem;
use crate::AppState;
use tauri::State;
use uuid::Uuid;

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// 用語を新規作成する
#[tauri::command]
pub fn create_glossary(
    project_id: String,
    term: String,
    category: String,
    state: State<AppState>,
) -> CmdResult<String> {
    let conn = state.db.lock().map_err(err)?;
    let id = Uuid::new_v4().to_string();

    let max_order: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM glossary WHERE project_id = ?1",
            rusqlite::params![project_id],
            |row| row.get(0),
        )
        .unwrap_or(-1);

    conn.execute(
        "INSERT INTO glossary (id, project_id, category, term, data, sort_order)
         VALUES (?1, ?2, ?3, ?4, '{}', ?5)",
        rusqlite::params![id, project_id, category, term, max_order + 1],
    )
    .map_err(err)?;

    Ok(id)
}

/// プロジェクトの全用語を取得する
#[tauri::command]
pub fn get_glossary(project_id: String, state: State<AppState>) -> CmdResult<Vec<GlossaryItem>> {
    let conn = state.db.lock().map_err(err)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, category, term, data, sort_order
             FROM glossary WHERE project_id = ?1 ORDER BY sort_order",
        )
        .map_err(err)?;

    let rows = stmt
        .query_map(rusqlite::params![project_id], |row| {
            Ok(GlossaryItem {
                id: row.get(0)?,
                project_id: row.get(1)?,
                category: row.get(2)?,
                term: row.get(3)?,
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

/// 用語を更新する
#[tauri::command]
pub fn update_glossary(
    id: String,
    term: String,
    category: String,
    data: String,
    state: State<AppState>,
) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute(
        "UPDATE glossary SET term = ?1, category = ?2, data = ?3 WHERE id = ?4",
        rusqlite::params![term, category, data, id],
    )
    .map_err(err)?;
    Ok(())
}

/// 用語を削除する（タグ連動削除含む）
#[tauri::command]
pub fn delete_glossary(id: String, state: State<AppState>) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    delete_tags_for_entity(&conn, "glossary", &id)?;
    conn.execute("DELETE FROM glossary WHERE id = ?1", rusqlite::params![id])
        .map_err(err)?;
    Ok(())
}

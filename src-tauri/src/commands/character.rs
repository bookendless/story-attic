use crate::commands::tag::delete_tags_for_entity;
use crate::models::Character;
use crate::AppState;
use tauri::State;
use uuid::Uuid;

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// キャラクターを新規作成する
#[tauri::command]
pub fn create_character(
    project_id: String,
    name: String,
    category: String,
    state: State<AppState>,
) -> CmdResult<String> {
    let conn = state.db.lock().map_err(err)?;
    let id = Uuid::new_v4().to_string();

    let max_order: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM characters WHERE project_id = ?1",
            rusqlite::params![project_id],
            |row| row.get(0),
        )
        .unwrap_or(-1);

    conn.execute(
        "INSERT INTO characters (id, project_id, category, name, data, sort_order)
         VALUES (?1, ?2, ?3, ?4, '{}', ?5)",
        rusqlite::params![id, project_id, category, name, max_order + 1],
    )
    .map_err(err)?;

    Ok(id)
}

/// プロジェクトの全キャラクターを取得する
#[tauri::command]
pub fn get_characters(project_id: String, state: State<AppState>) -> CmdResult<Vec<Character>> {
    let conn = state.db.lock().map_err(err)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, category, name, data, sort_order
             FROM characters WHERE project_id = ?1 ORDER BY sort_order",
        )
        .map_err(err)?;

    let rows = stmt
        .query_map(rusqlite::params![project_id], |row| {
            Ok(Character {
                id: row.get(0)?,
                project_id: row.get(1)?,
                category: row.get(2)?,
                name: row.get(3)?,
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

/// キャラクターを更新する
#[tauri::command]
pub fn update_character(
    id: String,
    name: String,
    category: String,
    data: String,
    state: State<AppState>,
) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute(
        "UPDATE characters SET name = ?1, category = ?2, data = ?3 WHERE id = ?4",
        rusqlite::params![name, category, data, id],
    )
    .map_err(err)?;
    Ok(())
}

/// キャラクターを削除する（タグ連動削除含む）
#[tauri::command]
pub fn delete_character(id: String, state: State<AppState>) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    delete_tags_for_entity(&conn, "character", &id)?;
    conn.execute("DELETE FROM characters WHERE id = ?1", rusqlite::params![id])
        .map_err(err)?;
    Ok(())
}

/// キャラクターの並び順を更新する
#[tauri::command]
pub fn reorder_characters(
    project_id: String,
    ordered_ids: Vec<String>,
    state: State<AppState>,
) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    for (i, cid) in ordered_ids.iter().enumerate() {
        conn.execute(
            "UPDATE characters SET sort_order = ?1 WHERE id = ?2 AND project_id = ?3",
            rusqlite::params![i as i64, cid, project_id],
        )
        .map_err(err)?;
    }
    Ok(())
}

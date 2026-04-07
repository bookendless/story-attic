use crate::commands::tag::delete_tags_for_entity;
use crate::models::Material;
use crate::AppState;
use tauri::State;
use uuid::Uuid;

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// 資料を新規作成する
#[tauri::command]
pub fn create_material(
    project_id: String,
    title: String,
    book: String,
    category: String,
    state: State<AppState>,
) -> CmdResult<String> {
    let conn = state.db.lock().map_err(err)?;
    let id = Uuid::new_v4().to_string();

    let max_order: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM materials WHERE project_id = ?1",
            rusqlite::params![project_id],
            |row| row.get(0),
        )
        .unwrap_or(-1);

    conn.execute(
        "INSERT INTO materials (id, project_id, book, category, title, data, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5, '{}', ?6)",
        rusqlite::params![id, project_id, book, category, title, max_order + 1],
    )
    .map_err(err)?;

    Ok(id)
}

/// プロジェクトの全資料を取得する
#[tauri::command]
pub fn get_materials(project_id: String, state: State<AppState>) -> CmdResult<Vec<Material>> {
    let conn = state.db.lock().map_err(err)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, book, category, title, data, sort_order
             FROM materials WHERE project_id = ?1 ORDER BY book, category, sort_order",
        )
        .map_err(err)?;

    let rows = stmt
        .query_map(rusqlite::params![project_id], |row| {
            Ok(Material {
                id: row.get(0)?,
                project_id: row.get(1)?,
                book: row.get(2)?,
                category: row.get(3)?,
                title: row.get(4)?,
                data: row.get(5)?,
                sort_order: row.get(6)?,
            })
        })
        .map_err(err)?;

    let mut items = Vec::new();
    for r in rows {
        items.push(r.map_err(err)?);
    }
    Ok(items)
}

/// 資料を更新する
#[tauri::command]
pub fn update_material(
    id: String,
    title: String,
    book: String,
    category: String,
    data: String,
    state: State<AppState>,
) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute(
        "UPDATE materials SET title = ?1, book = ?2, category = ?3, data = ?4 WHERE id = ?5",
        rusqlite::params![title, book, category, data, id],
    )
    .map_err(err)?;
    Ok(())
}

/// 資料を削除する（タグ連動削除含む）
#[tauri::command]
pub fn delete_material(id: String, state: State<AppState>) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    delete_tags_for_entity(&conn, "material", &id)?;
    conn.execute("DELETE FROM materials WHERE id = ?1", rusqlite::params![id])
        .map_err(err)?;
    Ok(())
}

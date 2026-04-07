use crate::models::Tag;
use crate::AppState;
use rusqlite::Connection;
use tauri::State;
use uuid::Uuid;

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// タグを追加する（重複時は既存IDを返す）
#[tauri::command]
pub fn add_tag(
    project_id: String,
    entity_type: String,
    entity_id: String,
    tag: String,
    state: State<AppState>,
) -> CmdResult<String> {
    let conn = state.db.lock().map_err(err)?;
    let id = Uuid::new_v4().to_string();

    // UNIQUE制約 (project_id, entity_type, entity_id, tag) により重複INSERTは無視
    conn.execute(
        "INSERT OR IGNORE INTO tags (id, project_id, entity_type, entity_id, tag)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![id, project_id, entity_type, entity_id, tag],
    )
    .map_err(err)?;

    // 実際に挿入されたか、既存のものかに関わらずIDを返す
    let actual_id: String = conn
        .query_row(
            "SELECT id FROM tags WHERE project_id = ?1 AND entity_type = ?2 AND entity_id = ?3 AND tag = ?4",
            rusqlite::params![project_id, entity_type, entity_id, tag],
            |row| row.get(0),
        )
        .map_err(err)?;

    Ok(actual_id)
}

/// タグを削除する
#[tauri::command]
pub fn remove_tag(id: String, state: State<AppState>) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute("DELETE FROM tags WHERE id = ?1", rusqlite::params![id])
        .map_err(err)?;
    Ok(())
}

/// 特定エンティティのタグ一覧を取得する
#[tauri::command]
pub fn get_tags(
    project_id: String,
    entity_type: String,
    entity_id: String,
    state: State<AppState>,
) -> CmdResult<Vec<Tag>> {
    let conn = state.db.lock().map_err(err)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, entity_type, entity_id, tag
             FROM tags
             WHERE project_id = ?1 AND entity_type = ?2 AND entity_id = ?3
             ORDER BY tag",
        )
        .map_err(err)?;

    let rows = stmt
        .query_map(rusqlite::params![project_id, entity_type, entity_id], |row| {
            Ok(Tag {
                id: row.get(0)?,
                project_id: row.get(1)?,
                entity_type: row.get(2)?,
                entity_id: row.get(3)?,
                tag: row.get(4)?,
            })
        })
        .map_err(err)?;

    let mut tags = Vec::new();
    for r in rows {
        tags.push(r.map_err(err)?);
    }
    Ok(tags)
}

/// プロジェクト内の全タグ名一覧を返す（DISTINCT、オートコンプリート用）
#[tauri::command]
pub fn get_all_tags(project_id: String, state: State<AppState>) -> CmdResult<Vec<String>> {
    let conn = state.db.lock().map_err(err)?;
    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT tag FROM tags WHERE project_id = ?1 ORDER BY tag",
        )
        .map_err(err)?;

    let rows = stmt
        .query_map(rusqlite::params![project_id], |row| row.get::<_, String>(0))
        .map_err(err)?;

    let mut tags = Vec::new();
    for r in rows {
        tags.push(r.map_err(err)?);
    }
    Ok(tags)
}

/// 指定タグを持つ全エンティティを返す（タグ横断検索）
#[tauri::command]
pub fn get_entities_by_tag(
    project_id: String,
    tag: String,
    state: State<AppState>,
) -> CmdResult<Vec<Tag>> {
    let conn = state.db.lock().map_err(err)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, entity_type, entity_id, tag
             FROM tags
             WHERE project_id = ?1 AND tag = ?2
             ORDER BY entity_type, entity_id",
        )
        .map_err(err)?;

    let rows = stmt
        .query_map(rusqlite::params![project_id, tag], |row| {
            Ok(Tag {
                id: row.get(0)?,
                project_id: row.get(1)?,
                entity_type: row.get(2)?,
                entity_id: row.get(3)?,
                tag: row.get(4)?,
            })
        })
        .map_err(err)?;

    let mut tags = Vec::new();
    for r in rows {
        tags.push(r.map_err(err)?);
    }
    Ok(tags)
}

/// エンティティに紐づくタグを一括削除する（各ドメインの delete コマンドから呼ぶ）
pub(crate) fn delete_tags_for_entity(
    conn: &Connection,
    entity_type: &str,
    entity_id: &str,
) -> Result<(), String> {
    conn.execute(
        "DELETE FROM tags WHERE entity_type = ?1 AND entity_id = ?2",
        rusqlite::params![entity_type, entity_id],
    )
    .map_err(err)?;
    Ok(())
}

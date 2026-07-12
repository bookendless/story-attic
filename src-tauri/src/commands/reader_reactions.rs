//! 読者反応（AI読者のライブ反応）の永続化コマンド
//!
//! 生成は `commands::ai::ai_get_reader_reactions`、保存・復元は本モジュールが担う。
//! 再生成時は同一 episode + persona の既存行を置換する。

use crate::models::ReaderReaction;
use crate::AppState;
use tauri::State;
use uuid::Uuid;

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// 保存リクエスト1件分（id / created_at はサーバー側で採番）
#[derive(serde::Deserialize)]
pub struct ReaderReactionInput {
    pub quote: String,
    pub comment: String,
    pub kind: String,
}

/// エピソードの読者反応を全件取得する（ペルソナ・作成順）
#[tauri::command]
pub fn list_reader_reactions(
    episode_id: String,
    state: State<AppState>,
) -> CmdResult<Vec<ReaderReaction>> {
    let conn = state.db.lock().map_err(err)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, episode_id, persona, quote, comment, kind, created_at
             FROM reader_reactions WHERE episode_id = ?1 ORDER BY persona, created_at, rowid",
        )
        .map_err(err)?;

    let rows = stmt
        .query_map(rusqlite::params![episode_id], |row| {
            Ok(ReaderReaction {
                id: row.get(0)?,
                episode_id: row.get(1)?,
                persona: row.get(2)?,
                quote: row.get(3)?,
                comment: row.get(4)?,
                kind: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(err)?;

    let mut items = Vec::new();
    for r in rows {
        items.push(r.map_err(err)?);
    }
    Ok(items)
}

/// 指定ペルソナの読者反応を置換保存する（再生成＝同ペルソナの旧反応を削除して挿入）
#[tauri::command]
pub fn save_reader_reactions(
    episode_id: String,
    persona: String,
    reactions: Vec<ReaderReactionInput>,
    state: State<AppState>,
) -> CmdResult<Vec<ReaderReaction>> {
    let mut conn = state.db.lock().map_err(err)?;
    let tx = conn.transaction().map_err(err)?;

    tx.execute(
        "DELETE FROM reader_reactions WHERE episode_id = ?1 AND persona = ?2",
        rusqlite::params![episode_id, persona],
    )
    .map_err(err)?;

    let mut saved = Vec::with_capacity(reactions.len());
    for r in &reactions {
        let id = Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO reader_reactions (id, episode_id, persona, quote, comment, kind, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))",
            rusqlite::params![id, episode_id, persona, r.quote, r.comment, r.kind],
        )
        .map_err(err)?;
        saved.push(ReaderReaction {
            id,
            episode_id: episode_id.clone(),
            persona: persona.clone(),
            quote: r.quote.clone(),
            comment: r.comment.clone(),
            kind: r.kind.clone(),
            created_at: String::new(),
        });
    }

    tx.commit().map_err(err)?;
    Ok(saved)
}

/// エピソードの読者反応を全消去する
#[tauri::command]
pub fn delete_reader_reactions(episode_id: String, state: State<AppState>) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute(
        "DELETE FROM reader_reactions WHERE episode_id = ?1",
        rusqlite::params![episode_id],
    )
    .map_err(err)?;
    Ok(())
}

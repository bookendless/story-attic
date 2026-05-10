use crate::models::{Chapter, ChapterTree, ChapterWithEpisodes, EpisodeSummary};
use crate::AppState;
use tauri::State;
use uuid::Uuid;

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// 章を新規作成する
#[tauri::command]
pub fn create_chapter(
    project_id: String,
    title: String,
    state: State<AppState>,
) -> CmdResult<String> {
    let conn = state.db.lock().map_err(err)?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let max_order: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM chapters WHERE project_id = ?1",
            rusqlite::params![project_id],
            |row| row.get(0),
        )
        .unwrap_or(-1);

    conn.execute(
        "INSERT INTO chapters (id, project_id, title, summary, sort_order, created_at)
         VALUES (?1, ?2, ?3, '', ?4, ?5)",
        rusqlite::params![id, project_id, title, max_order + 1, now],
    )
    .map_err(err)?;

    Ok(id)
}

/// 章のタイトルを変更する
#[tauri::command]
pub fn rename_chapter(id: String, title: String, state: State<AppState>) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute(
        "UPDATE chapters SET title = ?1 WHERE id = ?2",
        rusqlite::params![title, id],
    )
    .map_err(err)?;
    Ok(())
}

/// 章のタイトルと概要・設定・ムード・重要な出来事・五感を更新する
#[tauri::command]
pub fn update_chapter(
    id: String,
    title: String,
    summary: String,
    setting: String,
    mood: String,
    important_events: String,
    five_senses: String,
    state: State<AppState>,
) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute(
        "UPDATE chapters SET title = ?1, summary = ?2, setting = ?3, mood = ?4, important_events = ?5, five_senses = ?6 WHERE id = ?7",
        rusqlite::params![title, summary, setting, mood, important_events, five_senses, id],
    )
    .map_err(err)?;
    Ok(())
}

/// 章を削除する（chapter_episodesのCASCADE削除でエピソードは章から外れる）
#[tauri::command]
pub fn delete_chapter(id: String, state: State<AppState>) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute("DELETE FROM chapters WHERE id = ?1", rusqlite::params![id])
        .map_err(err)?;
    Ok(())
}

/// 章のノードツリー（中プロット）を保存する
#[tauri::command]
pub fn update_chapter_nodes(id: String, nodes: String, state: State<AppState>) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute(
        "UPDATE chapters SET nodes = ?1 WHERE id = ?2",
        rusqlite::params![nodes, id],
    )
    .map_err(err)?;
    Ok(())
}

/// 章のsort_orderを更新する
#[tauri::command]
pub fn reorder_chapters(
    project_id: String,
    ordered_ids: Vec<String>,
    state: State<AppState>,
) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    for (i, id) in ordered_ids.iter().enumerate() {
        conn.execute(
            "UPDATE chapters SET sort_order = ?1 WHERE id = ?2 AND project_id = ?3",
            rusqlite::params![i as i64, id, project_id],
        )
        .map_err(err)?;
    }
    Ok(())
}

/// エピソードを章に割り当てる
#[tauri::command]
pub fn assign_episode_to_chapter(
    episode_id: String,
    chapter_id: String,
    state: State<AppState>,
) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;

    // 既存の割り当てを削除してから再挿入（章の移動も対応）
    conn.execute(
        "DELETE FROM chapter_episodes WHERE episode_id = ?1",
        rusqlite::params![episode_id],
    )
    .map_err(err)?;

    let max_order: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM chapter_episodes WHERE chapter_id = ?1",
            rusqlite::params![chapter_id],
            |row| row.get(0),
        )
        .unwrap_or(-1);

    conn.execute(
        "INSERT INTO chapter_episodes (chapter_id, episode_id, sort_order) VALUES (?1, ?2, ?3)",
        rusqlite::params![chapter_id, episode_id, max_order + 1],
    )
    .map_err(err)?;

    Ok(())
}

/// エピソードの章割り当てを解除する
#[tauri::command]
pub fn unassign_episode(episode_id: String, state: State<AppState>) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute(
        "DELETE FROM chapter_episodes WHERE episode_id = ?1",
        rusqlite::params![episode_id],
    )
    .map_err(err)?;
    Ok(())
}

/// 左パネル用の章ツリー（章 + 所属エピソード + 未割当エピソード）を返す
#[tauri::command]
pub fn get_chapter_tree(project_id: String, state: State<AppState>) -> CmdResult<ChapterTree> {
    let conn = state.db.lock().map_err(err)?;

    // 章一覧を取得
    let chapters: Vec<Chapter> = conn
        .prepare(
            "SELECT id, project_id, title, summary, nodes, sort_order, created_at,
                    setting, mood, important_events, five_senses
             FROM chapters WHERE project_id = ?1 ORDER BY sort_order ASC",
        )
        .map_err(err)?
        .query_map(rusqlite::params![project_id], |row| {
            Ok(Chapter {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                summary: row.get(3)?,
                nodes: row.get(4)?,
                sort_order: row.get(5)?,
                created_at: row.get(6)?,
                setting: row.get(7)?,
                mood: row.get(8)?,
                important_events: row.get(9)?,
                five_senses: row.get(10)?,
            })
        })
        .map_err(err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(err)?;

    // 各章のエピソードを取得
    let mut chapters_with_episodes = Vec::new();
    for chapter in chapters {
        let episodes: Vec<EpisodeSummary> = conn
            .prepare(
                "SELECT e.id, e.project_id, e.title, ce.sort_order, text_char_count(e.body), e.updated_at
                 FROM episodes e
                 JOIN chapter_episodes ce ON ce.episode_id = e.id
                 WHERE ce.chapter_id = ?1
                 ORDER BY ce.sort_order ASC",
            )
            .map_err(err)?
            .query_map(rusqlite::params![chapter.id], |row| {
                Ok(EpisodeSummary {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    title: row.get(2)?,
                    sort_order: row.get(3)?,
                    char_count: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            })
            .map_err(err)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(err)?;

        chapters_with_episodes.push(ChapterWithEpisodes { chapter, episodes });
    }

    // 章未割当エピソードを取得
    let ungrouped: Vec<EpisodeSummary> = conn
        .prepare(
            "SELECT e.id, e.project_id, e.title, e.sort_order, text_char_count(e.body), e.updated_at
             FROM episodes e
             WHERE e.project_id = ?1
               AND e.id NOT IN (SELECT episode_id FROM chapter_episodes)
             ORDER BY e.sort_order ASC",
        )
        .map_err(err)?
        .query_map(rusqlite::params![project_id], |row| {
            Ok(EpisodeSummary {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                sort_order: row.get(3)?,
                char_count: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(err)?;

    Ok(ChapterTree {
        chapters: chapters_with_episodes,
        ungrouped,
    })
}

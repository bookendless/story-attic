use crate::models::{Plot, PlotStructure, Timeline};
use crate::AppState;
use tauri::State;
use uuid::Uuid;

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// プロットを新規作成する
#[tauri::command]
pub fn create_plot(
    project_id: String,
    title: String,
    plot_type: String,
    state: State<AppState>,
) -> CmdResult<String> {
    let conn = state.db.lock().map_err(err)?;
    let id = Uuid::new_v4().to_string();

    let max_order: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM plots WHERE project_id = ?1",
            rusqlite::params![project_id],
            |row| row.get(0),
        )
        .unwrap_or(-1);

    conn.execute(
        "INSERT INTO plots (id, project_id, title, plot_type, theme, data, sort_order)
         VALUES (?1, ?2, ?3, ?4, '', '{}', ?5)",
        rusqlite::params![id, project_id, title, plot_type, max_order + 1],
    )
    .map_err(err)?;

    Ok(id)
}

/// プロジェクトの全プロットを取得する
#[tauri::command]
pub fn get_plots(project_id: String, state: State<AppState>) -> CmdResult<Vec<Plot>> {
    let conn = state.db.lock().map_err(err)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, title, plot_type, theme, data, sort_order, is_pinned
             FROM plots WHERE project_id = ?1 ORDER BY sort_order",
        )
        .map_err(err)?;

    let rows = stmt
        .query_map(rusqlite::params![project_id], |row| {
            Ok(Plot {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                plot_type: row.get(3)?,
                theme: row.get(4)?,
                data: row.get(5)?,
                sort_order: row.get(6)?,
                is_pinned: row.get::<_, i64>(7)? != 0,
            })
        })
        .map_err(err)?;

    let mut items = Vec::new();
    for r in rows {
        items.push(r.map_err(err)?);
    }
    Ok(items)
}

/// 指定プロットをピン留め（決定稿）にする。同プロジェクト内の他プロットのピンは解除
#[tauri::command]
pub fn pin_plot(project_id: String, plot_id: String, state: State<AppState>) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute(
        "UPDATE plots SET is_pinned = 0 WHERE project_id = ?1",
        rusqlite::params![project_id],
    )
    .map_err(err)?;
    conn.execute(
        "UPDATE plots SET is_pinned = 1 WHERE id = ?1",
        rusqlite::params![plot_id],
    )
    .map_err(err)?;
    Ok(())
}

/// ピン留めを解除する
#[tauri::command]
pub fn unpin_plot(project_id: String, state: State<AppState>) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute(
        "UPDATE plots SET is_pinned = 0 WHERE project_id = ?1",
        rusqlite::params![project_id],
    )
    .map_err(err)?;
    Ok(())
}

/// プロットを更新する
#[tauri::command]
pub fn update_plot(
    id: String,
    title: String,
    plot_type: String,
    theme: String,
    data: String,
    state: State<AppState>,
) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute(
        "UPDATE plots SET title = ?1, plot_type = ?2, theme = ?3, data = ?4 WHERE id = ?5",
        rusqlite::params![title, plot_type, theme, data, id],
    )
    .map_err(err)?;
    Ok(())
}

/// プロットを削除する
#[tauri::command]
pub fn delete_plot(id: String, state: State<AppState>) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute("DELETE FROM plots WHERE id = ?1", rusqlite::params![id])
        .map_err(err)?;
    Ok(())
}

/// プロット構造設定を取得する（プロジェクトと1:1）
#[tauri::command]
pub fn get_plot_structure(project_id: String, state: State<AppState>) -> CmdResult<PlotStructure> {
    let conn = state.db.lock().map_err(err)?;

    match conn.query_row(
        "SELECT project_id, data FROM plot_structure WHERE project_id = ?1",
        rusqlite::params![project_id],
        |row| {
            Ok(PlotStructure {
                project_id: row.get(0)?,
                data: row.get(1)?,
            })
        },
    ) {
        Ok(ps) => Ok(ps),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(PlotStructure {
            project_id: project_id.clone(),
            data: "{}".to_string(),
        }),
        Err(e) => Err(err(e)),
    }
}

/// プロット構造設定を保存する（INSERT OR REPLACE）
#[tauri::command]
pub fn save_plot_structure(
    project_id: String,
    data: String,
    state: State<AppState>,
) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute(
        "INSERT OR REPLACE INTO plot_structure (project_id, data) VALUES (?1, ?2)",
        rusqlite::params![project_id, data],
    )
    .map_err(err)?;
    Ok(())
}

/// プロジェクトのタイムライン一覧を取得する
#[tauri::command]
pub fn get_timelines(project_id: String, state: State<AppState>) -> CmdResult<Vec<Timeline>> {
    let conn = state.db.lock().map_err(err)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, chapter_id, title, data
             FROM timelines WHERE project_id = ?1",
        )
        .map_err(err)?;

    let rows = stmt
        .query_map(rusqlite::params![project_id], |row| {
            Ok(Timeline {
                id: row.get(0)?,
                project_id: row.get(1)?,
                chapter_id: row.get(2)?,
                title: row.get(3)?,
                data: row.get(4)?,
            })
        })
        .map_err(err)?;

    let mut items = Vec::new();
    for r in rows {
        items.push(r.map_err(err)?);
    }
    Ok(items)
}

/// タイムラインを新規作成する
#[tauri::command]
pub fn create_timeline(
    project_id: String,
    chapter_id: Option<String>,
    state: State<AppState>,
) -> CmdResult<String> {
    let conn = state.db.lock().map_err(err)?;
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO timelines (id, project_id, chapter_id, title, data) VALUES (?1, ?2, ?3, '', '{}')",
        rusqlite::params![id, project_id, chapter_id],
    )
    .map_err(err)?;

    Ok(id)
}

/// タイムラインの名称を変更する
#[tauri::command]
pub fn rename_timeline(id: String, title: String, state: State<AppState>) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute(
        "UPDATE timelines SET title = ?1 WHERE id = ?2",
        rusqlite::params![title, id],
    )
    .map_err(err)?;
    Ok(())
}

/// タイムラインを保存（更新）する
#[tauri::command]
pub fn save_timeline(
    id: String,
    data: String,
    state: State<AppState>,
) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute(
        "UPDATE timelines SET data = ?1 WHERE id = ?2",
        rusqlite::params![data, id],
    )
    .map_err(err)?;
    Ok(())
}

/// タイムラインを削除する
#[tauri::command]
pub fn delete_timeline(id: String, state: State<AppState>) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute("DELETE FROM timelines WHERE id = ?1", rusqlite::params![id])
        .map_err(err)?;
    Ok(())
}

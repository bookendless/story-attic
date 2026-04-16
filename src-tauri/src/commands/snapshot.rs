use crate::models::{Snapshot, SnapshotSummary};
use crate::AppState;
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use std::io::{Read, Write};
use tauri::State;
use uuid::Uuid;

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// body を gzip 圧縮して Base64 エンコードする
fn compress_body(body: &str) -> CmdResult<String> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::best());
    encoder.write_all(body.as_bytes()).map_err(err)?;
    let compressed = encoder.finish().map_err(err)?;
    Ok(B64.encode(compressed))
}

/// Base64 デコード → gzip 展開して UTF-8 文字列を返す
fn decompress_body(encoded: &str) -> CmdResult<String> {
    let compressed = B64.decode(encoded).map_err(err)?;
    let mut decoder = GzDecoder::new(compressed.as_slice());
    let mut body = String::new();
    decoder.read_to_string(&mut body).map_err(err)?;
    Ok(body)
}

/// 現在のエピソード本文からスナップショットを作成する（自動上限 10 件）
#[tauri::command]
pub fn save_snapshot(episode_id: String, state: State<AppState>) -> CmdResult<SnapshotSummary> {
    let conn = state.db.lock().map_err(err)?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    // エピソードの現在の本文を取得
    let body: String = conn
        .query_row(
            "SELECT body FROM episodes WHERE id = ?1",
            rusqlite::params![episode_id],
            |row| row.get(0),
        )
        .map_err(err)?;

    // HTMLタグを除去した文字数
    let char_count = strip_html_len(&body);

    // gzip 圧縮 → Base64 エンコード
    let stored_body = compress_body(&body)?;

    conn.execute(
        "INSERT INTO history_snapshots (id, episode_id, body, char_count, is_compressed, label, created_at)
         VALUES (?1, ?2, ?3, ?4, 1, '', ?5)",
        rusqlite::params![id, episode_id, stored_body, char_count as i64, now],
    )
    .map_err(err)?;

    // 上限 10 件: 古いスナップショットを削除
    conn.execute(
        "DELETE FROM history_snapshots
         WHERE episode_id = ?1
           AND id NOT IN (
               SELECT id FROM history_snapshots
               WHERE episode_id = ?1
               ORDER BY created_at DESC
               LIMIT 10
           )",
        rusqlite::params![episode_id],
    )
    .map_err(err)?;

    Ok(SnapshotSummary {
        id,
        episode_id,
        char_count: char_count as i64,
        label: String::new(),
        created_at: now,
    })
}

/// エピソードのスナップショット一覧を返す（新しい順）
#[tauri::command]
pub fn list_snapshots(
    episode_id: String,
    state: State<AppState>,
) -> CmdResult<Vec<SnapshotSummary>> {
    let conn = state.db.lock().map_err(err)?;

    let mut stmt = conn
        .prepare(
            "SELECT id, episode_id, char_count, label, created_at
             FROM history_snapshots
             WHERE episode_id = ?1
             ORDER BY created_at DESC",
        )
        .map_err(err)?;

    let rows = stmt
        .query_map(rusqlite::params![episode_id], |row| {
            Ok(SnapshotSummary {
                id: row.get(0)?,
                episode_id: row.get(1)?,
                char_count: row.get(2)?,
                label: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(err)?;

    rows.collect::<Result<Vec<_>, _>>().map_err(err)
}

/// スナップショットの詳細（本文含む）を返す。圧縮済みなら展開する
#[tauri::command]
pub fn get_snapshot(id: String, state: State<AppState>) -> CmdResult<Snapshot> {
    let conn = state.db.lock().map_err(err)?;

    let (snap_id, episode_id, raw_body, char_count, is_compressed, label, created_at): (
        String,
        String,
        String,
        i64,
        i64,
        String,
        String,
    ) = conn
        .query_row(
            "SELECT id, episode_id, body, char_count, is_compressed, label, created_at
             FROM history_snapshots WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                ))
            },
        )
        .map_err(err)?;

    let body = if is_compressed == 1 {
        decompress_body(&raw_body)?
    } else {
        raw_body
    };

    Ok(Snapshot {
        id: snap_id,
        episode_id,
        body,
        char_count,
        label,
        created_at,
    })
}

/// スナップショットを削除する
#[tauri::command]
pub fn delete_snapshot(id: String, state: State<AppState>) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute(
        "DELETE FROM history_snapshots WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(err)?;
    Ok(())
}

/// スナップショットの本文をエピソードに復元する
#[tauri::command]
pub fn restore_snapshot(id: String, state: State<AppState>) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;

    let (episode_id, raw_body, is_compressed): (String, String, i64) = conn
        .query_row(
            "SELECT episode_id, body, is_compressed FROM history_snapshots WHERE id = ?1",
            rusqlite::params![id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(err)?;

    let body = if is_compressed == 1 {
        decompress_body(&raw_body)?
    } else {
        raw_body
    };

    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE episodes SET body = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![body, now, episode_id],
    )
    .map_err(err)?;

    // プロジェクトの updated_at も更新
    conn.execute(
        "UPDATE projects SET updated_at = ?1
         WHERE id = (SELECT project_id FROM episodes WHERE id = ?2)",
        rusqlite::params![now, episode_id],
    )
    .map_err(err)?;

    Ok(())
}

/// スナップショットにラベルを設定する
#[tauri::command]
pub fn label_snapshot(id: String, label: String, state: State<AppState>) -> CmdResult<()> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute(
        "UPDATE history_snapshots SET label = ?1 WHERE id = ?2",
        rusqlite::params![label, id],
    )
    .map_err(err)?;
    Ok(())
}

/// HTMLタグを除去した文字数を返す
fn strip_html_len(html: &str) -> usize {
    let mut count = 0;
    let mut in_tag = false;
    for ch in html.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => count += 1,
            _ => {}
        }
    }
    count
}

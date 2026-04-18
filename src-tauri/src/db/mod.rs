use rusqlite::{Connection, Result};
use std::path::Path;

/// データベース接続を初期化し、マイグレーションを実行する
pub fn initialize(db_path: &Path) -> Result<Connection> {
    let conn = Connection::open(db_path)?;

    // パフォーマンス・整合性のPRAGMA設定（設計書 §8）
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA foreign_keys=ON;
         PRAGMA synchronous=NORMAL;
         PRAGMA temp_store=MEMORY;
         PRAGMA mmap_size=268435456;",
    )?;

    // HTMLタグを除去した文字数を返すカスタム関数を登録
    register_text_char_count(&conn)?;

    run_migrations(&conn)?;

    Ok(conn)
}

/// HTMLタグを除去してテキスト文字数を返すSQLite関数を登録する
fn register_text_char_count(conn: &Connection) -> Result<()> {
    conn.create_scalar_function(
        "text_char_count",
        1,
        rusqlite::functions::FunctionFlags::SQLITE_UTF8 | rusqlite::functions::FunctionFlags::SQLITE_DETERMINISTIC,
        |ctx| {
            let html: String = ctx.get(0)?;
            let mut count: i64 = 0;
            let mut in_tag = false;
            for ch in html.chars() {
                match ch {
                    '<' => in_tag = true,
                    '>' => in_tag = false,
                    _ if !in_tag && ch != '\n' && ch != '\r' => count += 1,
                    _ => {}
                }
            }
            Ok(count)
        },
    )
}

/// マイグレーションを実行する
fn run_migrations(conn: &Connection) -> Result<()> {
    // マイグレーション管理テーブル
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        );",
    )?;

    // v1: 初期スキーマ
    let applied_v1: i64 = conn.query_row(
        "SELECT COUNT(*) FROM schema_migrations WHERE version = 1",
        [],
        |row| row.get(0),
    )?;

    if applied_v1 == 0 {
        let sql = include_str!("migrations/001_initial.sql");
        conn.execute_batch(sql)?;
        conn.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (1, datetime('now'))",
            [],
        )?;
    }

    // v2: スナップショット圧縮フラグ・ラベル追加
    let applied_v2: i64 = conn.query_row(
        "SELECT COUNT(*) FROM schema_migrations WHERE version = 2",
        [],
        |row| row.get(0),
    )?;

    if applied_v2 == 0 {
        let sql = include_str!("migrations/002_snapshot_update.sql");
        conn.execute_batch(sql)?;
        conn.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (2, datetime('now'))",
            [],
        )?;
    }

    // v3: AI Story Builder インポート対応（synopses, plot_threads）
    let applied_v3: i64 = conn.query_row(
        "SELECT COUNT(*) FROM schema_migrations WHERE version = 3",
        [],
        |row| row.get(0),
    )?;

    if applied_v3 == 0 {
        let sql = include_str!("migrations/003_ai_story_builder.sql");
        conn.execute_batch(sql)?;
        conn.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (3, datetime('now'))",
            [],
        )?;
    }

    // v4: 章に summary カラムを追加
    let applied_v4: i64 = conn.query_row(
        "SELECT COUNT(*) FROM schema_migrations WHERE version = 4",
        [],
        |row| row.get(0),
    )?;

    if applied_v4 == 0 {
        let sql = include_str!("migrations/004_chapter_summary.sql");
        conn.execute_batch(sql)?;
        conn.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (4, datetime('now'))",
            [],
        )?;
    }

    Ok(())
}

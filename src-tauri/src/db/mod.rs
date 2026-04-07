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

    // 適用済みバージョンを確認
    let applied: i64 = conn.query_row(
        "SELECT COUNT(*) FROM schema_migrations WHERE version = 1",
        [],
        |row| row.get(0),
    )?;

    if applied == 0 {
        let sql = include_str!("migrations/001_initial.sql");
        conn.execute_batch(sql)?;
        conn.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (1, datetime('now'))",
            [],
        )?;
    }

    Ok(())
}

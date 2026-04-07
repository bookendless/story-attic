use rusqlite::Connection;
use std::sync::Mutex;
use tauri::Manager;

pub mod commands;
pub mod db;
pub mod models;

/// アプリ全体で共有するSQLite接続
pub struct AppState {
    pub db: Mutex<Connection>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // データディレクトリを取得（%APPDATA%/StoryAttic/）
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("アプリデータディレクトリの取得に失敗しました");
            std::fs::create_dir_all(&app_dir)
                .expect("アプリデータディレクトリの作成に失敗しました");

            let db_path = app_dir.join("story-attic.db");
            let conn = db::initialize(&db_path).expect("データベースの初期化に失敗しました");

            app.manage(AppState {
                db: Mutex::new(conn),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // プロジェクト管理
            commands::project::create_project,
            commands::project::list_projects,
            commands::project::get_project,
            commands::project::update_project,
            commands::project::delete_project,
            // エピソード管理
            commands::episode::create_episode,
            commands::episode::get_episode,
            commands::episode::list_episodes,
            commands::episode::save_episode,
            commands::episode::rename_episode,
            commands::episode::delete_episode,
            commands::episode::reorder_episodes,
            // 章管理
            commands::chapter::create_chapter,
            commands::chapter::rename_chapter,
            commands::chapter::delete_chapter,
            commands::chapter::reorder_chapters,
            commands::chapter::assign_episode_to_chapter,
            commands::chapter::unassign_episode,
            commands::chapter::get_chapter_tree,
            // インポート / エクスポート
            commands::file_io::export_project_json,
            commands::file_io::import_project_json,
            commands::file_io::export_episodes_txt,
            commands::file_io::export_episodes_zip,
            commands::file_io::import_txt_files,
            // 設定
            commands::settings::get_settings,
            commands::settings::save_settings,
            // 文章分析・校正
            commands::analysis::analyze_text,
            commands::analysis::run_proofread,
            // スナップショット
            commands::snapshot::save_snapshot,
            commands::snapshot::list_snapshots,
            commands::snapshot::get_snapshot,
            commands::snapshot::delete_snapshot,
            // APIキー管理
            commands::keyring::save_api_key,
            commands::keyring::get_api_key,
            commands::keyring::delete_api_key,
            // AI連携
            commands::ai::ai_get_settings,
            commands::ai::ai_save_settings,
            commands::ai::ai_send_message,
            commands::ai::ai_test_connection,
            commands::ai::ai_get_whisper,
            // タグ
            commands::tag::add_tag,
            commands::tag::remove_tag,
            commands::tag::get_tags,
            commands::tag::get_all_tags,
            commands::tag::get_entities_by_tag,
            // キャラクター
            commands::character::create_character,
            commands::character::get_characters,
            commands::character::update_character,
            commands::character::delete_character,
            commands::character::reorder_characters,
            // 用語集
            commands::glossary::create_glossary,
            commands::glossary::get_glossary,
            commands::glossary::update_glossary,
            commands::glossary::delete_glossary,
            // メモ
            commands::memo::create_memo,
            commands::memo::get_memos,
            commands::memo::update_memo,
            commands::memo::delete_memo,
            // 資料
            commands::material::create_material,
            commands::material::get_materials,
            commands::material::update_material,
            commands::material::delete_material,
            // プロット
            commands::plot::create_plot,
            commands::plot::get_plots,
            commands::plot::update_plot,
            commands::plot::delete_plot,
            commands::plot::get_plot_structure,
            commands::plot::save_plot_structure,
            commands::plot::get_timelines,
            commands::plot::create_timeline,
            commands::plot::save_timeline,
            commands::plot::delete_timeline,
        ])
        .run(tauri::generate_context!())
        .expect("Tauriアプリケーションの起動に失敗しました");
}

//! APIキー管理コマンド
//! OSのキーチェーン（Windows: Credential Manager、macOS: Keychain）を使って
//! APIキーをセキュアに保存・取得・削除する。
//!
//! # セッションキャッシュ
//! Windows の Credential Manager は非同期コンテキストから読み取ると
//! 稀に `NoEntry` を返すことがある。これを回避するため、`save_api_key` は
//! キーチェーンへの保存と同時にプロセス内のインメモリキャッシュにも記録する。
//! 非同期コンテキストからの読み取りはキャッシュを優先し、キャッシュにない
//! 場合のみキーチェーンへフォールバックする。
//!
//! service 引数にはプロバイダー名を渡す（例: "openai", "anthropic", "google", "xai"）。

use keyring::Entry;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

/// キーリングのユーザー名（アプリ固定値）
const KEYRING_USER: &str = "story-attic";

/// 受け付ける service 値（不明値を弾く allowlist）
const ALLOWED_SERVICES: &[&str] = &["openai", "anthropic", "google", "xai", "local"];

fn ensure_allowed_service(service: &str) -> Result<(), String> {
    if ALLOWED_SERVICES.contains(&service) {
        Ok(())
    } else {
        Err(format!("不正なプロバイダー: {}", service))
    }
}

/// セッション内の API キーキャッシュ（プロセス終了で消える）
pub(crate) fn session_cache() -> &'static Mutex<HashMap<String, String>> {
    static CACHE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// APIキーを保存する（キーチェーン + セッションキャッシュ）
///
/// キーチェーン書き込みに失敗した場合は `Err` を返す。
/// セッションキャッシュへのフォールバック保存は廃止 — 永続化に失敗しているのに
/// 「保存済み」と見なされる UX を防ぐため、UI 側で明示的に通知する。
#[tauri::command]
pub fn save_api_key(service: String, api_key: String) -> Result<(), String> {
    ensure_allowed_service(&service)?;

    if api_key.trim().is_empty() {
        return Err("APIキーが空です".into());
    }

    let entry = Entry::new(&service, KEYRING_USER)
        .map_err(|e| format!("キーリング初期化エラー: {}", e))?;
    entry
        .set_password(&api_key)
        .map_err(|e| format!("キーリング保存エラー: {}", e))?;

    if let Ok(mut cache) = session_cache().lock() {
        cache.insert(service, api_key);
    }
    Ok(())
}

/// APIキーを取得する。未設定の場合は None を返す
#[tauri::command]
pub fn get_api_key(service: String) -> Result<Option<String>, String> {
    ensure_allowed_service(&service)?;

    if let Ok(cache) = session_cache().lock() {
        if let Some(key) = cache.get(&service) {
            return Ok(Some(key.clone()));
        }
    }

    let entry = Entry::new(&service, KEYRING_USER).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// APIキーが保存されているかだけを判定する（鍵値は IPC 上に流さない）
#[tauri::command]
pub fn has_api_key(service: String) -> Result<bool, String> {
    ensure_allowed_service(&service)?;

    if let Ok(cache) = session_cache().lock() {
        if cache.contains_key(&service) {
            return Ok(true);
        }
    }

    let entry = Entry::new(&service, KEYRING_USER).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(e) => Err(e.to_string()),
    }
}

/// APIキーを削除する
#[tauri::command]
pub fn delete_api_key(service: String) -> Result<(), String> {
    ensure_allowed_service(&service)?;

    if let Ok(mut cache) = session_cache().lock() {
        cache.remove(&service);
    }

    let entry = Entry::new(&service, KEYRING_USER).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

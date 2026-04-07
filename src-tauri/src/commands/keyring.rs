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
//! service 引数にはプロバイダー名を渡す（例: "openai", "anthropic"）。

use keyring::Entry;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

/// キーリングのユーザー名（アプリ固定値）
const KEYRING_USER: &str = "story-attic";

/// セッション内の API キーキャッシュ（プロセス終了で消える）
pub(crate) fn session_cache() -> &'static Mutex<HashMap<String, String>> {
    static CACHE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// APIキーを保存する（キーチェーン + セッションキャッシュ）
#[tauri::command]
pub fn save_api_key(service: String, api_key: String) -> Result<(), String> {
    // キーチェーンに保存（失敗してもキャッシュには入れる）
    let keychain_result = Entry::new(&service, KEYRING_USER)
        .map_err(|e| e.to_string())
        .and_then(|entry| entry.set_password(&api_key).map_err(|e| e.to_string()));

    // セッションキャッシュに保存（常に実行）
    if let Ok(mut cache) = session_cache().lock() {
        cache.insert(service.clone(), api_key.clone());
    }

    // キーチェーンが失敗した場合でもキャッシュに保存済みなので Ok を返す
    // （次回アプリ起動時は再入力が必要になるが、現セッションでは動作する）
    if let Err(e) = keychain_result {
        log::warn!("キーチェーン保存失敗（セッションキャッシュで継続）: {}", e);
    }

    Ok(())
}

/// APIキーを取得する。未設定の場合は None を返す
#[tauri::command]
pub fn get_api_key(service: String) -> Result<Option<String>, String> {
    // キャッシュを優先
    if let Ok(cache) = session_cache().lock() {
        if let Some(key) = cache.get(&service) {
            return Ok(Some(key.clone()));
        }
    }

    // キャッシュにない場合はキーチェーンから取得
    let entry = Entry::new(&service, KEYRING_USER).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// APIキーを削除する
#[tauri::command]
pub fn delete_api_key(service: String) -> Result<(), String> {
    // セッションキャッシュからも削除
    if let Ok(mut cache) = session_cache().lock() {
        cache.remove(&service);
    }

    let entry = Entry::new(&service, KEYRING_USER).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        // 未設定の場合は正常終了扱い
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

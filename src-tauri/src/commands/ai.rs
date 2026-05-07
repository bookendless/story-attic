//! AI連携コマンド
//!
//! # ストリーミング設計
//! `ai_send_message` はレスポンスをチャンク単位で `"ai-chunk"` イベントとして emit する。
//! フロントエンドは `listen("ai-chunk", ...)` で受信し、テキストを蓄積する。
//!
//! # 対応プロバイダー
//! - `"openai"`   → OpenAI API（GPT-4o 等）
//! - `"anthropic"` → Anthropic API（Claude 等）
//! - `"local"`    → OpenAI互換ローカルLLM（Ollama 等）

use crate::models::ai::{AiChunkPayload, AiMessage, AiSettings};
use crate::AppState;
use tauri::Emitter;

// =========================================
// DB 操作
// =========================================

/// プロジェクトの AI 設定を取得する
#[tauri::command]
pub async fn ai_get_settings(
    state: tauri::State<'_, AppState>,
    project_id: String,
) -> Result<AiSettings, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let result = db.query_row(
        "SELECT provider, model, system_prompt, data FROM ai_settings WHERE project_id = ?1",
        [&project_id],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        },
    );

    match result {
        Ok((provider, model, system_prompt, data_str)) => {
            let data: serde_json::Value =
                serde_json::from_str(&data_str).unwrap_or(serde_json::json!({}));
            Ok(AiSettings {
                provider,
                model,
                system_prompt,
                base_url: data["base_url"].as_str().map(String::from),
                creator_type: data["creator_type"].as_str().map(String::from),
            })
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(AiSettings::default()),
        Err(e) => Err(e.to_string()),
    }
}

/// プロジェクトの AI 設定を保存する
#[tauri::command]
pub async fn ai_save_settings(
    state: tauri::State<'_, AppState>,
    project_id: String,
    settings: AiSettings,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let data = serde_json::json!({
        "base_url": settings.base_url,
        "creator_type": settings.creator_type,
    });
    db.execute(
        "INSERT INTO ai_settings (project_id, provider, model, system_prompt, data)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(project_id) DO UPDATE SET
           provider      = excluded.provider,
           model         = excluded.model,
           system_prompt = excluded.system_prompt,
           data          = excluded.data",
        rusqlite::params![
            project_id,
            settings.provider,
            settings.model,
            settings.system_prompt,
            data.to_string(),
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// =========================================
// ストリーミング送信
// =========================================

/// メッセージを送信し、レスポンスを "ai-chunk" イベントでストリーム配信する
///
/// `system_prompt` はフロントエンドが catalystPromptBuilder で動的構築して渡す。
/// DB の system_prompt は送信には使用しない（設定保存用途のみ）。
#[tauri::command]
pub async fn ai_send_message(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    project_id: String,
    messages: Vec<AiMessage>,
    system_prompt: String,
) -> Result<(), String> {
    // DB から設定を取得（ロックはこのブロックで解放）
    let settings = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let result = db.query_row(
            "SELECT provider, model, system_prompt, data FROM ai_settings WHERE project_id = ?1",
            [&project_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                ))
            },
        );
        match result {
            Ok((provider, model, system_prompt_db, data_str)) => {
                let data: serde_json::Value =
                    serde_json::from_str(&data_str).unwrap_or(serde_json::json!({}));
                AiSettings {
                    provider,
                    model,
                    system_prompt: system_prompt_db,
                    base_url: data["base_url"].as_str().map(String::from),
                    creator_type: data["creator_type"].as_str().map(String::from),
                }
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => {
                emit_error(&app, "AI設定が未構成です。設定画面でプロバイダーとAPIキーを設定してください。".into());
                return Ok(());
            }
            Err(e) => return Err(e.to_string()),
        }
    };

    if settings.provider.is_empty() || settings.model.is_empty() {
        emit_error(&app, "プロバイダーまたはモデルが未設定です。".into());
        return Ok(());
    }

    // キーリングから API キーを取得
    let api_key = match get_api_key(&settings.provider).await {
        Ok(Some(key)) => key,
        Ok(None) => {
            emit_error(&app, format!("{}のAPIキーが設定されていません。設定画面で登録してください。", settings.provider));
            return Ok(());
        }
        Err(e) => {
            emit_error(&app, format!("APIキーの取得に失敗しました: {}", e));
            return Ok(());
        }
    };

    // role == "system" のメッセージを除外（Anthropic は messages[] に system ロールを含められないため）
    let clean_messages: Vec<AiMessage> = messages.into_iter()
        .filter(|m| m.role != "system")
        .collect();

    // プロバイダー別にストリーミング（フロントが構築したsystem_promptを使用）
    match settings.provider.as_str() {
        "anthropic" => {
            stream_anthropic(&app, &api_key, &settings.model, &system_prompt, &clean_messages).await
        }
        _ => {
            // "openai" または "local"（OpenAI互換）
            let base_url = settings
                .base_url
                .as_deref()
                .unwrap_or("https://api.openai.com/v1")
                .trim_end_matches('/')
                .to_string();
            stream_openai_compatible(&app, &api_key, &base_url, &settings.model, &system_prompt, &clean_messages).await
        }
    }
}

// =========================================
// 接続テスト
// =========================================

/// API 接続をテストする
#[tauri::command]
pub async fn ai_test_connection(
    service: String,
    base_url: Option<String>,
) -> Result<String, String> {
    let api_key = match get_api_key(&service).await? {
        Some(key) => key,
        None => return Err("APIキーが設定されていません".into()),
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    match service.as_str() {
        "anthropic" => {
            // 最小リクエストで疎通確認
            let resp = client
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", &api_key)
                .header("anthropic-version", "2023-06-01")
                .header("Content-Type", "application/json")
                .json(&serde_json::json!({
                    "model": "claude-haiku-4-5-20251001",
                    "max_tokens": 1,
                    "messages": [{"role": "user", "content": "hi"}],
                }))
                .send()
                .await
                .map_err(|e| format!("接続エラー: {}", e))?;

            if resp.status().is_success() {
                Ok("接続に成功しました".into())
            } else {
                let body = resp.text().await.unwrap_or_default();
                Err(format!("APIエラー: {}", body))
            }
        }
        _ => {
            // OpenAI / local: モデル一覧エンドポイントで確認
            let url = base_url
                .as_deref()
                .unwrap_or("https://api.openai.com/v1")
                .trim_end_matches('/');
            let resp = client
                .get(format!("{}/models", url))
                .header("Authorization", format!("Bearer {}", api_key))
                .send()
                .await
                .map_err(|e| format!("接続エラー: {}", e))?;

            if resp.status().is_success() {
                Ok("接続に成功しました".into())
            } else {
                let body = resp.text().await.unwrap_or_default();
                Err(format!("APIエラー: {}", body))
            }
        }
    }
}

// =========================================
// ゴーストつぶやき（非ストリーミング・短文）
// =========================================

/// ゴーストちゃんが一言つぶやく（AI生成・非ストリーミング）
///
/// - AI設定が未構成の場合はエラーを返す（フロントでランダムつぶやきにフォールバック）
/// - `context` には現在書いているテキストの末尾数百文字を渡す
#[tauri::command]
pub async fn ai_get_whisper(
    state: tauri::State<'_, AppState>,
    project_id: String,
    context: String,
) -> Result<String, String> {
    // DB から設定を取得
    let settings = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let result = db.query_row(
            "SELECT provider, model, system_prompt, data FROM ai_settings WHERE project_id = ?1",
            [&project_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(3)?,
                ))
            },
        );
        match result {
            Ok((provider, model, data_str)) => {
                let data: serde_json::Value =
                    serde_json::from_str(&data_str).unwrap_or(serde_json::json!({}));
                (provider, model, data["base_url"].as_str().map(String::from))
            }
            Err(_) => return Err("AI未設定".into()),
        }
    };

    let (provider, model, base_url) = settings;
    if provider.is_empty() || model.is_empty() {
        return Err("AI未設定".into());
    }

    let api_key = match get_api_key(&provider).await? {
        Some(key) => key,
        None => return Err("APIキー未設定".into()),
    };

    let user_msg = if context.is_empty() {
        "執筆の準備をしているようです。一言声をかけてください。".to_string()
    } else {
        format!("今書いているもの（末尾抜粋）：\n{}\n\n一言声をかけてください。", context)
    };

    match provider.as_str() {
        "anthropic" => single_call_anthropic(&api_key, &model, WHISPER_SYSTEM, &user_msg, 80).await,
        _ => {
            let url = base_url
                .as_deref()
                .unwrap_or("https://api.openai.com/v1")
                .trim_end_matches('/');
            single_call_openai_compatible(&api_key, url, &model, WHISPER_SYSTEM, &user_msg, 80).await
        }
    }
}

/// ゴーストつぶやき用システムプロンプト
const WHISPER_SYSTEM: &str = "\
あなたは「ゴーストちゃん」という小さな執筆の妖精です。\
執筆中のユーザーをそっと見守り、短い一言だけ声をかけます。\
返答は必ず日本語で、30文字以内の短い一言にしてください。\
励まし・共感・さりげない観察など、やさしく幻想的なトーンで。\
絵文字は使わないこと。かぎ括弧も使わないこと。";

/// 読者シミュレーター用システムプロンプト（一般読者）
const READER_CASUAL: &str = "\
あなたはこの物語を楽しんでいる一般読者です。\
今読んだ場面を踏まえ、読者として感じたこと・気になったことを伝えます。\
返答は必ず日本語で50文字以内。一人称で語ること。\
感情・疑問・次への期待のどれかを素直に伝えること。\
書き方への批評・改善提案・続きの予測は禁止。絵文字は使わないこと。";

/// 読者シミュレーター用システムプロンプト（ジャンル読者）
const READER_GENRE: &str = "\
あなたはこのジャンルに詳しい熱心な読者です。\
今読んだ場面の中で、物語全体への期待や気になる展開・伏線について語ります。\
返答は必ず日本語で50文字以内。感情より「この先どうなる？」という視点で。\
書き方への批評・改善提案は禁止。絵文字は使わないこと。";

/// 読者シミュレーター用システムプロンプト（批評的読者）
const READER_CRITICAL: &str = "\
あなたはこの物語を注意深く読んでいる読者です。\
理解できた点・理解が追いついていない点を正直に伝えます。\
返答は必ず日本語で50文字以内。「〜がわからなくなりました」「〜の理由が掴めていません」など。\
書き方への批評・改善提案は禁止。読者体験の正直な報告のみ。絵文字は使わないこと。";

/// 読者シミュレーター（AI生成・非ストリーミング）
///
/// `persona`: "casual" | "genre" | "critical"
/// DB から登場キャラ名を取得してコンテキストに含める
#[tauri::command]
pub async fn ai_get_reader_perspective(
    state: tauri::State<'_, AppState>,
    project_id: String,
    context: String,
    persona: String,
) -> Result<String, String> {
    let (provider, model, base_url, char_names) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let result = db.query_row(
            "SELECT provider, model, data FROM ai_settings WHERE project_id = ?1",
            [&project_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            },
        );
        let (provider, model, data_str) = match result {
            Ok(r) => r,
            Err(_) => return Err("AI未設定".into()),
        };
        let data: serde_json::Value =
            serde_json::from_str(&data_str).unwrap_or(serde_json::json!({}));
        let base_url = data["base_url"].as_str().map(String::from);

        // 登場キャラ名を取得（name は直接カラム）
        let mut stmt = db
            .prepare("SELECT name FROM characters WHERE project_id = ?1")
            .map_err(|e| e.to_string())?;
        let names: Vec<String> = stmt
            .query_map([&project_id], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .filter(|n| !n.is_empty())
            .collect();

        (provider, model, base_url, names)
    };

    if provider.is_empty() || model.is_empty() {
        return Err("AI未設定".into());
    }

    let api_key = match get_api_key(&provider).await? {
        Some(key) => key,
        None => return Err("APIキー未設定".into()),
    };

    let system = match persona.as_str() {
        "genre" => READER_GENRE,
        "critical" => READER_CRITICAL,
        _ => READER_CASUAL,
    };

    let char_context = if char_names.is_empty() {
        String::new()
    } else {
        format!("\n登場人物: {}", char_names.join("、"))
    };
    let user_msg = format!(
        "今読んだ場面（末尾抜粋）：\n{}{}\n\n読者として一言伝えてください。",
        context, char_context
    );

    match provider.as_str() {
        "anthropic" => single_call_anthropic(&api_key, &model, system, &user_msg, 120).await,
        _ => {
            let url = base_url
                .as_deref()
                .unwrap_or("https://api.openai.com/v1")
                .trim_end_matches('/');
            single_call_openai_compatible(&api_key, url, &model, system, &user_msg, 120).await
        }
    }
}

async fn single_call_openai_compatible(
    api_key: &str,
    base_url: &str,
    model: &str,
    system: &str,
    user_msg: &str,
    max_tokens: u32,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .post(format!("{}/chat/completions", base_url))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "model": model,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user",   "content": user_msg},
            ],
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(resp.text().await.unwrap_or_default());
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    json["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| "レスポンスの解析に失敗しました".into())
}

async fn single_call_anthropic(
    api_key: &str,
    model: &str,
    system: &str,
    user_msg: &str,
    max_tokens: u32,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "model": model,
            "max_tokens": max_tokens,
            "system": system,
            "messages": [{"role": "user", "content": user_msg}],
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(resp.text().await.unwrap_or_default());
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    json["content"][0]["text"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| "レスポンスの解析に失敗しました".into())
}

// =========================================
// プライベートヘルパー
// =========================================

/// API キーを取得する（非同期版）
///
/// # 読み取り順序
/// 1. セッションキャッシュ（`commands::keyring::session_cache`）を確認
/// 2. キャッシュにない場合は `spawn_blocking` 経由でキーチェーンから取得
///
/// セッションキャッシュは `save_api_key` 呼び出し時に必ず更新されるため、
/// 同一セッション内では常にキャッシュから取得できる。
async fn get_api_key(service: &str) -> Result<Option<String>, String> {
    // 1. セッションキャッシュを優先
    if let Ok(cache) = super::keyring::session_cache().lock() {
        if let Some(key) = cache.get(service) {
            return Ok(Some(key.clone()));
        }
    }

    // 2. キャッシュにない場合は spawn_blocking でキーチェーンから取得
    let service = service.to_string();
    tokio::task::spawn_blocking(move || -> Result<Option<String>, String> {
        let entry =
            keyring::Entry::new(&service, "story-attic").map_err(|e| e.to_string())?;
        match entry.get_password() {
            Ok(key) => Ok(Some(key)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(format!("キーリングエラー: {}", e)),
        }
    })
    .await
    .map_err(|e| format!("spawn_blocking失敗: {}", e))?
}

/// "ai-chunk" イベントでテキストチャンクを送信する
fn emit_chunk(app: &tauri::AppHandle, content: &str) {
    let _ = app.emit(
        "ai-chunk",
        AiChunkPayload {
            content: content.to_string(),
            done: false,
            error: None,
        },
    );
}

/// "ai-chunk" イベントで完了を通知する
fn emit_done(app: &tauri::AppHandle) {
    let _ = app.emit(
        "ai-chunk",
        AiChunkPayload {
            content: String::new(),
            done: true,
            error: None,
        },
    );
}

/// "ai-chunk" イベントでエラーを通知する
fn emit_error(app: &tauri::AppHandle, message: String) {
    let _ = app.emit(
        "ai-chunk",
        AiChunkPayload {
            content: String::new(),
            done: true,
            error: Some(message),
        },
    );
}

/// OpenAI / OpenAI互換 API へのストリーミングリクエスト
async fn stream_openai_compatible(
    app: &tauri::AppHandle,
    api_key: &str,
    base_url: &str,
    model: &str,
    system_prompt: &str,
    messages: &[AiMessage],
) -> Result<(), String> {
    let mut api_messages: Vec<serde_json::Value> = Vec::new();
    if !system_prompt.is_empty() {
        api_messages.push(serde_json::json!({"role": "system", "content": system_prompt}));
    }
    for m in messages {
        api_messages.push(serde_json::json!({"role": m.role, "content": m.content}));
    }

    let client = reqwest::Client::new();
    let mut response = client
        .post(format!("{}/chat/completions", base_url))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "model": model,
            "messages": api_messages,
            "stream": true,
        }))
        .send()
        .await
        .map_err(|e| format!("HTTPリクエストに失敗しました: {}", e))?;

    if !response.status().is_success() {
        let body = response.text().await.unwrap_or_default();
        emit_error(app, format!("APIエラー: {}", body));
        return Ok(());
    }

    let mut buf = String::new();
    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        buf.push_str(&String::from_utf8_lossy(&chunk));
        while let Some(pos) = buf.find('\n') {
            let line = buf[..pos].trim().to_string();
            buf = buf[pos + 1..].to_string();

            if let Some(data) = line.strip_prefix("data: ") {
                if data == "[DONE]" {
                    emit_done(app);
                    return Ok(());
                }
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(content) =
                        json["choices"][0]["delta"]["content"].as_str()
                    {
                        if !content.is_empty() {
                            emit_chunk(app, content);
                        }
                    }
                }
            }
        }
    }

    emit_done(app);
    Ok(())
}

/// Anthropic API へのストリーミングリクエスト
async fn stream_anthropic(
    app: &tauri::AppHandle,
    api_key: &str,
    model: &str,
    system_prompt: &str,
    messages: &[AiMessage],
) -> Result<(), String> {
    let api_messages: Vec<serde_json::Value> = messages
        .iter()
        .map(|m| serde_json::json!({"role": m.role, "content": m.content}))
        .collect();

    let mut body = serde_json::json!({
        "model": model,
        "max_tokens": 2048,
        "messages": api_messages,
        "stream": true,
    });
    if !system_prompt.is_empty() {
        body["system"] = serde_json::json!(system_prompt);
    }

    let client = reqwest::Client::new();
    let mut response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("HTTPリクエストに失敗しました: {}", e))?;

    if !response.status().is_success() {
        let body_text = response.text().await.unwrap_or_default();
        emit_error(app, format!("APIエラー: {}", body_text));
        return Ok(());
    }

    let mut buf = String::new();
    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        buf.push_str(&String::from_utf8_lossy(&chunk));
        while let Some(pos) = buf.find('\n') {
            let line = buf[..pos].trim().to_string();
            buf = buf[pos + 1..].to_string();

            if let Some(data) = line.strip_prefix("data: ") {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                    match json["type"].as_str() {
                        Some("content_block_delta") => {
                            if let Some(text) = json["delta"]["text"].as_str() {
                                if !text.is_empty() {
                                    emit_chunk(app, text);
                                }
                            }
                        }
                        Some("message_stop") => {
                            emit_done(app);
                            return Ok(());
                        }
                        Some("error") => {
                            let msg = json["error"]["message"]
                                .as_str()
                                .unwrap_or("不明なエラー")
                                .to_string();
                            emit_error(app, msg);
                            return Ok(());
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    emit_done(app);
    Ok(())
}

//! AI連携コマンド
//!
//! # ストリーミング設計
//! `ai_send_message` はレスポンスをチャンク単位で `"ai-chunk"` イベントとして emit する。
//! フロントエンドは `listen("ai-chunk", ...)` で受信し、テキストを蓄積する。
//!
//! # 対応プロバイダー
//! - `"openai"`    → OpenAI API（GPT-4o 等）
//! - `"anthropic"` → Anthropic API（Claude 等）
//! - `"google"`    → Google Gemini（OpenAI 互換エンドポイント経由）
//! - `"xai"`       → xAI Grok（OpenAI 互換エンドポイント経由）
//! - `"local"`     → OpenAI互換ローカルLLM（Ollama 等）

use crate::models::ai::{AiChunkPayload, AiMessage, AiSettings};
use crate::AppState;
use std::sync::OnceLock;
use tauri::Emitter;

/// アプリ全体で共有する HTTP クライアント。
/// 呼び出しごとに生成するとコネクションプール・TLSセッションが毎回破棄され、
/// リクエストごとに DNS + TCP + TLS ハンドシェイクが再実行されるため1個を使い回す。
/// 全体タイムアウトはストリーミング応答を途中で打ち切ってしまうためクライアントには設定せず、
/// 非ストリーミング呼び出し側が `RequestBuilder::timeout()` でリクエスト単位に指定する。
fn http_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .connect_timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("HTTPクライアントの初期化に失敗しました")
    })
}

// =========================================
// プロバイダーガード / 既定値 / 秘匿マスキング
// =========================================

/// 受け付けるプロバイダー識別子（不明値を弾く allowlist）
const PROVIDER_ALLOWLIST: &[&str] = &["openai", "anthropic", "google", "xai", "local"];

fn ensure_allowed(provider: &str) -> Result<(), String> {
    if PROVIDER_ALLOWLIST.contains(&provider) {
        Ok(())
    } else {
        Err(format!("不正なプロバイダー: {}", provider))
    }
}

/// プロバイダー別の既定ベースURL（OpenAI 互換エンドポイント）
fn default_base_url(provider: &str) -> &'static str {
    match provider {
        "google" => "https://generativelanguage.googleapis.com/v1beta/openai",
        "xai" => "https://api.x.ai/v1",
        _ => "https://api.openai.com/v1",
    }
}

/// local プロバイダーの base_url をバリデーションする。
/// http(s)://localhost/* / http(s)://127.0.0.1/* / http(s)://[::1]/* のみ許可。
fn validate_local_base_url(raw: &str) -> Result<String, String> {
    let without_scheme = raw
        .strip_prefix("http://")
        .or_else(|| raw.strip_prefix("https://"))
        .ok_or_else(|| "base_url は http:// または https:// で始まる必要があります".to_string())?;

    let host = without_scheme.split(['/', ':']).next().unwrap_or("");
    let host_clean = host.trim_matches('[').trim_matches(']');

    if host_clean != "localhost" && host_clean != "127.0.0.1" && host_clean != "::1" {
        return Err(
            "local プロバイダーの base_url はループバックアドレス（localhost / 127.0.0.1 / ::1）のみ許可されています".into(),
        );
    }

    // OpenAI 互換ルートは {base_url}/chat/completions・{base_url}/models を叩くため
    // パス部が無い（host:port のみ）場合は /v1 を補完する。
    // 例: http://localhost:1234 → http://localhost:1234/v1
    //     http://localhost:11434/v1 → そのまま
    let trimmed = raw.trim_end_matches('/');
    let after_scheme = trimmed
        .strip_prefix("http://")
        .or_else(|| trimmed.strip_prefix("https://"))
        .unwrap_or(trimmed);
    if after_scheme.contains('/') {
        Ok(trimmed.to_string())
    } else {
        Ok(format!("{}/v1", trimmed))
    }
}

/// プロバイダーと設定から有効な base_url を解決する。
/// local 以外のプロバイダーは base_url を無視し常に既定値を返す。
fn resolve_base_url(provider: &str, base_url: Option<&str>) -> Result<String, String> {
    if provider == "local" {
        match base_url {
            Some(url) if !url.is_empty() => validate_local_base_url(url),
            // base_url 未設定時は Ollama 既定エンドポイントへフォールバック
            _ => Ok("http://localhost:11434/v1".to_string()),
        }
    } else {
        Ok(default_base_url(provider).to_string())
    }
}

/// API エラー本文に含まれうる秘匿情報をマスクする。
/// - 渡された `api_key` の文字列一致はそのまま `***` 置換
/// - 一般的なキー先頭プレフィクス (`sk-` / `xai-` / `AIza`) は粗く検出して `***` に
fn mask_secrets(api_key: &str, body: &str) -> String {
    let mut out = body.to_string();
    if !api_key.is_empty() {
        out = out.replace(api_key, "***");
    }
    for prefix in ["sk-", "xai-", "AIza"] {
        let mut ranges: Vec<(usize, usize)> = Vec::new();
        let mut idx = 0;
        while let Some(rel) = out[idx..].find(prefix) {
            let start = idx + rel;
            let tail_len: usize = out[start + prefix.len()..]
                .chars()
                .take_while(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
                .map(|c| c.len_utf8())
                .sum();
            let end = start + prefix.len() + tail_len;
            if tail_len < 8 {
                idx = start + prefix.len();
                continue;
            }
            ranges.push((start, end));
            idx = end;
        }
        for (start, end) in ranges.into_iter().rev() {
            out.replace_range(start..end, "***");
        }
    }
    out
}

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
    // local 以外は base_url を保存しない。local はバリデーション済み値のみ保存。
    let validated_base_url: Option<String> = if settings.provider == "local" {
        match settings.base_url.as_deref() {
            Some(url) if !url.is_empty() => Some(validate_local_base_url(url)?),
            other => other.map(String::from),
        }
    } else {
        None
    };
    let data = serde_json::json!({
        "base_url": validated_base_url,
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

    if settings.provider.is_empty() {
        emit_error(&app, "プロバイダーが未設定です。".into());
        return Ok(());
    }
    // local はモデル未指定でも続行（LMStudio は無視、Ollama はサーバー側エラーになる）
    if settings.model.is_empty() && settings.provider != "local" {
        emit_error(&app, "モデルが未設定です。".into());
        return Ok(());
    }

    if let Err(e) = ensure_allowed(&settings.provider) {
        emit_error(&app, e);
        return Ok(());
    }

    // キーリングから API キーを取得（local は未設定でも空文字で続行）
    let api_key = match resolve_api_key(&settings.provider).await {
        Ok(key) => key,
        Err(e) => {
            emit_error(&app, e);
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
            // OpenAI / Google / xAI / local — OpenAI 互換ルート
            let base_url = match resolve_base_url(&settings.provider, settings.base_url.as_deref()) {
                Ok(url) => url,
                Err(e) => { emit_error(&app, e); return Ok(()); }
            };
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
    ensure_allowed(&service)?;

    let api_key = resolve_api_key(&service).await?;

    let client = http_client();

    match service.as_str() {
        "anthropic" => {
            // 最小リクエストで疎通確認
            let resp = client
                .post("https://api.anthropic.com/v1/messages")
                .timeout(std::time::Duration::from_secs(10))
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
                .map_err(|e| format!("接続エラー: {}", mask_secrets(&api_key, &e.to_string())))?;

            if resp.status().is_success() {
                Ok("接続に成功しました".into())
            } else {
                let body = resp.text().await.unwrap_or_default();
                Err(format!("APIエラー: {}", mask_secrets(&api_key, &body)))
            }
        }
        _ => {
            // OpenAI / Google / xAI / local: モデル一覧エンドポイントで確認
            let url_owned = resolve_base_url(&service, base_url.as_deref())?;
            let resp = client
                .get(format!("{}/models", url_owned))
                .timeout(std::time::Duration::from_secs(10))
                .header("Authorization", format!("Bearer {}", api_key))
                .send()
                .await
                .map_err(|e| format!("接続エラー: {}", mask_secrets(&api_key, &e.to_string())))?;

            if resp.status().is_success() {
                Ok("接続に成功しました".into())
            } else {
                let body = resp.text().await.unwrap_or_default();
                Err(format!("APIエラー: {}", mask_secrets(&api_key, &body)))
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
    if provider.is_empty() || (model.is_empty() && provider != "local") {
        return Err("AI未設定".into());
    }
    ensure_allowed(&provider)?;

    let api_key = resolve_api_key(&provider).await?;

    let user_msg = if context.is_empty() {
        "執筆の準備をしているようです。一言声をかけてください。".to_string()
    } else {
        format!("今書いているもの（末尾抜粋）：\n{}\n\n一言声をかけてください。", context)
    };

    match provider.as_str() {
        "anthropic" => {
            single_call_anthropic(&api_key, &model, WHISPER_SYSTEM, &user_msg, 1000)
                .await
                .map_err(|e| mask_secrets(&api_key, &e))
        }
        _ => {
            let url_owned = resolve_base_url(&provider, base_url.as_deref())
                .map_err(|e| mask_secrets(&api_key, &e))?;
            single_call_openai_compatible(&api_key, &url_owned, &model, WHISPER_SYSTEM, &user_msg, 1000)
                .await
                .map_err(|e| mask_secrets(&api_key, &e))
        }
    }
}

/// ゴーストつぶやき用システムプロンプト
const WHISPER_SYSTEM: &str = "\
あなたは「ゴーストちゃん」という小さな執筆の妖精です。\
執筆中のユーザーをそっと見守り、一言だけ声をかけます。\
返答は必ず日本語で、30文字程度の一言にしてください。\
励まし・共感・さりげない観察など、やさしく寄り添うようなトーンで。\
「～ですね」など、語尾を少しぼかすとゴーストっぽさが増します。\
絵文字は使わないこと。かぎ括弧も使わないこと。";

/// 読者シミュレーター用システムプロンプト（一般読者）
const READER_CASUAL: &str = "\
あなたはこの物語を楽しんでいる一般読者です。\
今読んだ場面を踏まえ、読者として感じたこと・気になったことを伝えます。\
返答は必ず日本語で50文字程度。一人称で語ること。\
感情・疑問・次への期待のどれかを素直に伝えること。\
書き方への批評・改善提案・続きの予測は禁止。絵文字は使わないこと。";

/// 読者シミュレーター用システムプロンプト（ジャンル読者）
const READER_GENRE: &str = "\
あなたはこのジャンルに詳しい熱心な読者です。\
今読んだ場面の中で、物語全体への期待や気になる展開・伏線について語ります。\
返答は必ず日本語で50文字程度。感情より「この先どうなる？」という視点で。\
書き方への批評・改善提案は禁止。絵文字は使わないこと。";

/// 読者シミュレーター用システムプロンプト（批評的読者）
const READER_CRITICAL: &str = "\
あなたはこの物語を注意深く読んでいる読者です。\
理解できた点・理解が追いついていない点を正直に伝えます。\
返答は必ず日本語で50文字程度。「〜がわからなくなりました」「〜の理由が掴めていません」など。\
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

    if provider.is_empty() || (model.is_empty() && provider != "local") {
        return Err("AI未設定".into());
    }
    ensure_allowed(&provider)?;

    let api_key = resolve_api_key(&provider).await?;

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
        "anthropic" => single_call_anthropic(&api_key, &model, system, &user_msg, 1000)
            .await
            .map_err(|e| mask_secrets(&api_key, &e)),
        _ => {
            let url_owned = resolve_base_url(&provider, base_url.as_deref())
                .map_err(|e| mask_secrets(&api_key, &e))?;
            single_call_openai_compatible(&api_key, &url_owned, &model, system, &user_msg, 1000)
                .await
                .map_err(|e| mask_secrets(&api_key, &e))
        }
    }
}

// =========================================
// 読者ライブ反応（非ストリーミング・JSON返却）
// =========================================

/// 読者ライブ反応の共通指示（JSON形式・引用ルール）
const REACTION_COMMON: &str = "\
これから小説の一章を読みます。読みながら感じた反応を、\
必ず以下のJSON形式のみで返してください（説明文・前置き・コードブロック記法は一切不要）。\
{\"reactions\":[{\"quote\":\"...\",\"comment\":\"...\",\"kind\":\"...\"}]}\
quote=反応した箇所の本文からの逐語引用（10〜25文字程度）。言い換え・要約・省略は禁止。\
章全体への感想の場合のみ空文字にすること。\
comment=読者としての生の反応（日本語30〜60文字、一人称）。\
kind=\"emotion\"（感情の動き・鳥肌・笑い等）/\"prediction\"（この先の展開・伏線・犯人などの予想）\
/\"concern\"（読みづらさ・中だるみ・離脱しそうな箇所の正直な報告）のいずれか。\
反応は3〜6件。prediction を必ず1件以上含めること。予想は具体的に（「○○が怪しい」「○○になりそう」等）。\
執筆技法の改善提案・添削は禁止。あくまで一読者としての体験を語ること。\
JSON以外の文字は絶対に出力しないこと。";

/// ペルソナID → 人格プロンプト（フロントエンド readerPersonas.ts と対応）
fn reaction_persona_prompt(persona: &str) -> &'static str {
    match persona {
        "light_novel" => "あなたはラノベとWeb小説を読み漁っている高校生読者です。\
            テンポの良さと勢いが大好きで、熱い展開やキャラの掛け合いに素直に盛り上がります。\
            口調はネット掲示板・コメント欄風のくだけたノリで。",
        "mystery" => "あなたはミステリー・サスペンスを年間200冊読む考察マニアです。\
            伏線・違和感・登場人物の言動の矛盾を見逃さず、常に先の展開と真相を予想しながら読みます。\
            口調は落ち着いた考察好きのファン。predictionを多めに。",
        "editor" => "あなたは商業出版で長年小説を担当してきた辛口の編集者です。\
            ただし今日は読者として読み、読者の目線が離れる箇所・引きの弱さに正直に反応します。\
            口調は簡潔で遠慮なし。concernを多めに。ただし良い箇所は率直に褒めること。",
        "romance" => "あなたは恋愛小説と少女漫画が大好きな読者です。\
            人物の感情の機微・関係性の変化に敏感で、ときめく場面には全力で反応します。\
            口調は感情豊かで共感重視。",
        "literary" => "あなたは純文学と翻訳文学を好む読者です。\
            文体・情景描写・言葉選びの美しさを味わいながらゆっくり読みます。\
            口調は静かで丁寧、印象に残った一文を引用して語るのが好き。",
        _ => "あなたは通勤時間にスマホで小説を読むライトな一般読者です。\
            難しいことは考えず、面白ければ続きを読み、飽きたら離脱します。\
            口調は気軽な感想コメント風。",
    }
}

/// 読者ライブ反応の本文文字数上限（フロントエンド ReaderReactionsPanel と一致させること）
const REACTION_MAX_CHARS: usize = 8000;

/// 指定ペルソナがエピソード本文を読み、本文引用付きの反応リストを返す（AI生成・非ストリーミング）
///
/// `persona`: "light_novel" | "mystery" | "editor" | "romance" | "literary" | "casual"
/// 1ペルソナ=1呼び出し。フロントエンドは複数ペルソナ分を並列 invoke する。
#[tauri::command]
pub async fn ai_get_reader_reactions(
    state: tauri::State<'_, AppState>,
    project_id: String,
    episode_id: String,
    persona: String,
) -> Result<String, String> {
    let (provider, model, base_url, body) = {
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

        let html: String = db
            .query_row(
                "SELECT body FROM episodes WHERE id = ?1",
                [&episode_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        (provider, model, base_url, html)
    };

    if provider.is_empty() || (model.is_empty() && provider != "local") {
        return Err("AI未設定".into());
    }
    ensure_allowed(&provider)?;

    let api_key = resolve_api_key(&provider).await?;

    // HTMLタグ除去（フロントエンド stripHtml と同様に段落境界を改行へ変換し、
    // quote の逐語引用が平文と一致するようにする）
    let plain = strip_html_to_plain(&body);
    // 読者は頭から読むため先頭優先で切り詰め（文字境界安全）
    let text: String = plain.chars().take(REACTION_MAX_CHARS).collect();

    if text.trim().is_empty() {
        return Err("本文が空です".into());
    }

    let system = format!("{}\n{}", reaction_persona_prompt(&persona), REACTION_COMMON);
    let user_msg = format!("【本文】\n{}", text);

    // 推論（thinking）モデルは出力枠を内部推論にも消費するため枠を広めに確保する
    match provider.as_str() {
        "anthropic" => single_call_anthropic(&api_key, &model, &system, &user_msg, 8000)
            .await
            .map_err(|e| mask_secrets(&api_key, &e)),
        _ => {
            let url_owned = resolve_base_url(&provider, base_url.as_deref())
                .map_err(|e| mask_secrets(&api_key, &e))?;
            single_call_openai_compatible(&api_key, &url_owned, &model, &system, &user_msg, 8000)
                .await
                .map_err(|e| mask_secrets(&api_key, &e))
        }
    }
}

/// HTMLを平文へ変換する。</p> </div> </li> <br> を改行に置き換える
/// （フロントエンド ProofreadPanel.tsx の stripHtml と同一仕様を維持すること）
fn strip_html_to_plain(html: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;
    let mut tag_buf = String::new();
    for ch in html.chars() {
        match ch {
            '<' => {
                in_tag = true;
                tag_buf.clear();
            }
            '>' if in_tag => {
                in_tag = false;
                let tl = tag_buf.to_lowercase();
                let is_break = tl.starts_with("/p")
                    || tl.starts_with("/div")
                    || tl.starts_with("/li")
                    || tl.starts_with("br");
                if is_break && !result.ends_with('\n') {
                    result.push('\n');
                }
            }
            _ if in_tag => tag_buf.push(ch),
            _ => result.push(ch),
        }
    }
    result
}

// =========================================
// 共鳴スコア（非ストリーミング・JSON返却）
// =========================================

/// 共鳴スコアフィードバック用システムプロンプト
const RESONANCE_SYSTEM: &str = "\
あなたは小説編集者です。渡された文章を以下の4軸で100点満点評価し、\
必ずJSON形式のみで返してください（説明文不要）。\
{\"tension\":<0-100>,\"empathy\":<0-100>,\"tempo\":<0-100>,\"surprise\":<0-100>,\
\"suggestions\":[\"改善提案1\",\"改善提案2\",\"改善提案3\"]}\
tension=緊張感・ドラマ性, empathy=読者の感情移入しやすさ, \
tempo=文章のテンポ・リズム感, surprise=意外性・展開の新鮮さ。\
改善提案は具体的に3つ、日本語で。JSON以外の文字は絶対に出力しないこと。";

/// 文章の共鳴スコアを4軸で評価する（AI生成・非ストリーミング）
#[tauri::command]
pub async fn ai_get_resonance_score(
    state: tauri::State<'_, AppState>,
    project_id: String,
    content: String,
) -> Result<String, String> {
    let (provider, model, base_url) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let result = db.query_row(
            "SELECT provider, model, data FROM ai_settings WHERE project_id = ?1",
            [&project_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?)),
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

    if provider.is_empty() || (model.is_empty() && provider != "local") {
        return Err("AI未設定".into());
    }
    ensure_allowed(&provider)?;

    let api_key = resolve_api_key(&provider).await?;

    let body: String = content.chars().take(3000).collect();
    let user_msg = format!("以下の文章を評価してください:\n\n{}", body);

    match provider.as_str() {
        "anthropic" => single_call_anthropic(&api_key, &model, RESONANCE_SYSTEM, &user_msg, 400)
            .await
            .map_err(|e| mask_secrets(&api_key, &e)),
        _ => {
            let url_owned = resolve_base_url(&provider, base_url.as_deref())
                .map_err(|e| mask_secrets(&api_key, &e))?;
            single_call_openai_compatible(&api_key, &url_owned, &model, RESONANCE_SYSTEM, &user_msg, 400)
                .await
                .map_err(|e| mask_secrets(&api_key, &e))
        }
    }
}

// =========================================
// クリシェ（常套句）校正（非ストリーミング・JSON返却）
// =========================================

/// クリシェ校正用システムプロンプト
const CLICHE_SYSTEM: &str = "\
あなたは小説の文章校正の専門家です。最初に渡される【世界観】情報を必ず踏まえ、\
続く【本文】から「クリシェ（常套句・手垢のついた決まり文句）」を抽出してください。\
各クリシェについて、その作品の世界観・テーマに馴染む代替表現を1〜3個提案してください。\
必ず以下のJSON形式のみで返してください（説明文・前置き・コードブロック記法は一切不要）。\
{\"issues\":[{\"phrase\":\"...\",\"context\":\"...\",\"reason\":\"...\",\"suggestions\":[\"...\"]}]}\
phrase=本文中のクリシェ表現。本文からの逐語引用とし、言い換え・要約・省略は禁止。\
context=phraseを含む前後を含めた本文中の短い一節（20〜40文字程度、こちらも逐語引用）。\
reason=なぜ常套句と判断したか（1文、日本語）。\
suggestions=世界観・テーマに沿った代替表現を1〜3個（日本語）。\
クリシェが見つからない場合は {\"issues\":[]} を返すこと。指摘は最大10件まで。\
JSON以外の文字は絶対に出力しないこと。";

/// 本文からクリシェ（常套句）を抽出し、世界観に沿った代替表現を提案する（AI生成・非ストリーミング）
#[tauri::command]
pub async fn ai_get_cliche_check(
    state: tauri::State<'_, AppState>,
    project_id: String,
    content: String,
    worldview: String,
) -> Result<String, String> {
    let (provider, model, base_url) = {
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
        match result {
            Ok((provider, model, data_str)) => {
                let data: serde_json::Value =
                    serde_json::from_str(&data_str).unwrap_or(serde_json::json!({}));
                (provider, model, data["base_url"].as_str().map(String::from))
            }
            Err(_) => return Err("AI未設定".into()),
        }
    };

    if provider.is_empty() || (model.is_empty() && provider != "local") {
        return Err("AI未設定".into());
    }
    ensure_allowed(&provider)?;

    let api_key = resolve_api_key(&provider).await?;

    // 文字境界安全に切り詰め（バイト境界スライスによる多バイト文字パニックを回避）
    let body: String = content.chars().take(6000).collect();
    let worldview_trimmed: String = worldview.chars().take(2000).collect();
    let wv: &str = if worldview_trimmed.trim().is_empty() {
        "（特に指定なし）"
    } else {
        worldview_trimmed.as_str()
    };

    let user_msg = format!("【世界観】\n{}\n\n【本文】\n{}", wv, body);

    // 推論（thinking）モデルは出力枠を内部推論にも消費するため枠を広めに確保する
    match provider.as_str() {
        "anthropic" => single_call_anthropic(&api_key, &model, CLICHE_SYSTEM, &user_msg, 8000)
            .await
            .map_err(|e| mask_secrets(&api_key, &e)),
        _ => {
            let url_owned = resolve_base_url(&provider, base_url.as_deref())
                .map_err(|e| mask_secrets(&api_key, &e))?;
            single_call_openai_compatible(&api_key, &url_owned, &model, CLICHE_SYSTEM, &user_msg, 8000)
                .await
                .map_err(|e| mask_secrets(&api_key, &e))
        }
    }
}

// =========================================
// 読者情報格差分析（非ストリーミング・JSON返却）
// =========================================

/// 読者情報格差分析用システムプロンプト
const INFO_GAP_SYSTEM: &str = "\
あなたは物語分析の専門家です。渡された小説本文とキャラクター設定を読み、\
指定エピソード終了時点での「情報の非対称性」を分析し、\
必ずJSON形式のみで返してください。\
{\"reader_knows\":[\"...\"],\"protagonist_knows\":[\"...\"],\"hidden\":[\"...\"],\"analysis_note\":\"...\"}\
reader_knows=読者がこの時点で知っている情報（最大5件）、\
protagonist_knows=主人公視点で知っている情報（最大5件）、\
hidden=読者にまだ明かされていない情報・伏線（最大5件）、\
analysis_note=情報格差の特徴を1〜2文で（日本語）。\
JSON以外の文字は絶対に出力しないこと。";

/// 指定エピソードまでの読者情報格差を分析する（AI生成・非ストリーミング）
#[tauri::command]
pub async fn ai_get_info_asymmetry(
    state: tauri::State<'_, AppState>,
    project_id: String,
    episode_id: String,
) -> Result<String, String> {
    let (provider, model, base_url, story_text, char_context) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;

        let result = db.query_row(
            "SELECT provider, model, data FROM ai_settings WHERE project_id = ?1",
            [&project_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?)),
        );
        let (provider, model, data_str) = match result {
            Ok(r) => r,
            Err(_) => return Err("AI未設定".into()),
        };
        let data: serde_json::Value =
            serde_json::from_str(&data_str).unwrap_or(serde_json::json!({}));
        let base_url = data["base_url"].as_str().map(String::from);

        // 対象エピソードの sort_order を取得
        let target_order: i64 = db.query_row(
            "SELECT sort_order FROM episodes WHERE id = ?1",
            [&episode_id],
            |row| row.get(0),
        ).unwrap_or(0);

        // 対象エピソードまでの全エピソード本文を結合（最大 3000 文字）
        let mut stmt = db.prepare(
            "SELECT title, body FROM episodes WHERE project_id = ?1 AND sort_order <= ?2 ORDER BY sort_order ASC",
        ).map_err(|e| e.to_string())?;
        let episodes: Vec<(String, String)> = stmt
            .query_map(rusqlite::params![project_id, target_order], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        let mut combined = String::new();
        for (title, body) in &episodes {
            let stripped: String = {
                let mut s = String::new();
                let mut in_tag = false;
                for ch in body.chars() {
                    match ch {
                        '<' => in_tag = true,
                        '>' => in_tag = false,
                        _ if !in_tag => s.push(ch),
                        _ => {}
                    }
                }
                s
            };
            combined.push_str(&format!("【{}】\n{}\n\n", title, stripped));
            if combined.len() >= 3000 {
                // 文字境界まで戻してから切る（日本語のUTF-8マルチバイトでのpanic回避）
                let mut end = 3000;
                while end > 0 && !combined.is_char_boundary(end) {
                    end -= 1;
                }
                combined.truncate(end);
                break;
            }
        }

        // キャラクター名一覧
        let mut char_stmt = db.prepare(
            "SELECT name FROM characters WHERE project_id = ?1",
        ).map_err(|e| e.to_string())?;
        let names: Vec<String> = char_stmt
            .query_map([&project_id], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .filter(|n| !n.is_empty())
            .collect();
        let char_context = if names.is_empty() {
            String::new()
        } else {
            format!("\n\n登場人物: {}", names.join("、"))
        };

        (provider, model, base_url, combined, char_context)
    };

    if provider.is_empty() || (model.is_empty() && provider != "local") {
        return Err("AI未設定".into());
    }
    ensure_allowed(&provider)?;

    let api_key = resolve_api_key(&provider).await?;

    let user_msg = format!(
        "以下の小説本文を分析してください。{}\n\n本文:\n{}",
        char_context, story_text
    );

    match provider.as_str() {
        "anthropic" => single_call_anthropic(&api_key, &model, INFO_GAP_SYSTEM, &user_msg, 2000)
            .await
            .map_err(|e| mask_secrets(&api_key, &e)),
        _ => {
            let url_owned = resolve_base_url(&provider, base_url.as_deref())
                .map_err(|e| mask_secrets(&api_key, &e))?;
            single_call_openai_compatible(&api_key, &url_owned, &model, INFO_GAP_SYSTEM, &user_msg, 2000)
                .await
                .map_err(|e| mask_secrets(&api_key, &e))
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
    let resp = http_client()
        .post(format!("{}/chat/completions", base_url))
        .timeout(std::time::Duration::from_secs(60))
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
    match json["choices"][0]["message"]["content"].as_str() {
        Some(s) if !s.trim().is_empty() => Ok(s.trim().to_string()),
        _ => {
            // 解析失敗・空回答時は生レスポンスの一部を含めて返す（診断用）
            let snippet: String = json.to_string().chars().take(2000).collect();
            Err(format!("レスポンスの解析に失敗しました: {}", snippet))
        }
    }
}

async fn single_call_anthropic(
    api_key: &str,
    model: &str,
    system: &str,
    user_msg: &str,
    max_tokens: u32,
) -> Result<String, String> {
    let resp = http_client()
        .post("https://api.anthropic.com/v1/messages")
        .timeout(std::time::Duration::from_secs(60))
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
    // content 配列から最初の text ブロックを探す（拡張思考モデルでは先頭が thinking ブロックになる）
    let text = json["content"].as_array().and_then(|arr| {
        arr.iter().find_map(|block| {
            if block["type"] == "text" { block["text"].as_str() } else { None }
        })
    });
    match text {
        Some(s) if !s.trim().is_empty() => Ok(s.trim().to_string()),
        _ => {
            // 解析失敗・空回答時は生レスポンスの一部を含めて返す（診断用）
            let snippet: String = json.to_string().chars().take(2000).collect();
            Err(format!("レスポンスの解析に失敗しました: {}", snippet))
        }
    }
}

// =========================================
// プライベートヘルパー
// =========================================

/// プロバイダー別にAPIキーを解決する。
/// `local` プロバイダーはキー未設定でも空文字で続行（Ollama/LMStudio は認証不要）。
/// それ以外はキー未設定をエラーとして返す。
async fn resolve_api_key(provider: &str) -> Result<String, String> {
    match get_api_key(provider).await? {
        Some(key) => Ok(key),
        None if provider == "local" => Ok(String::new()),
        None => Err(format!(
            "{}のAPIキーが設定されていません。設定画面で登録してください。",
            provider
        )),
    }
}

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

    let mut response = http_client()
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
        emit_error(app, format!("APIエラー: {}", mask_secrets(api_key, &body)));
        return Ok(());
    }

    let mut byte_buf: Vec<u8> = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        byte_buf.extend_from_slice(&chunk);
        while let Some(pos) = byte_buf.iter().position(|&b| b == b'\n') {
            let line_bytes = byte_buf[..pos].to_vec();
            byte_buf.drain(..=pos);
            let line = String::from_utf8_lossy(&line_bytes).trim().to_string();

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

    let mut response = http_client()
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
        emit_error(app, format!("APIエラー: {}", mask_secrets(api_key, &body_text)));
        return Ok(());
    }

    let mut byte_buf: Vec<u8> = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        byte_buf.extend_from_slice(&chunk);
        while let Some(pos) = byte_buf.iter().position(|&b| b == b'\n') {
            let line_bytes = byte_buf[..pos].to_vec();
            byte_buf.drain(..=pos);
            let line = String::from_utf8_lossy(&line_bytes).trim().to_string();

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

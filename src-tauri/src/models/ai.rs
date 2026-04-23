//! AI連携に関するデータ型定義

use serde::{Deserialize, Serialize};

/// チャットメッセージ（role: "user" | "assistant" | "system"）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiMessage {
    pub role: String,
    pub content: String,
}

/// AI設定（プロジェクト単位で保存）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AiSettings {
    /// プロバイダー識別子（"openai" | "anthropic" | "local"）
    pub provider: String,
    /// 使用するモデル名
    pub model: String,
    /// システムプロンプト（設定保存用。送信時はフロント側で動的構築）
    pub system_prompt: String,
    /// ローカルLLM用ベースURL（例: "http://localhost:11434/v1"）
    pub base_url: Option<String>,
    /// 作家タイプ（"explorer" | "architect"）
    pub creator_type: Option<String>,
}

/// ストリーミング中に emit するイベントペイロード
#[derive(Debug, Clone, Serialize)]
pub struct AiChunkPayload {
    /// 今回のテキストチャンク（done=true のとき空文字）
    pub content: String,
    /// ストリーム終了フラグ
    pub done: bool,
    /// エラーメッセージ（エラー時のみ Some）
    pub error: Option<String>,
}

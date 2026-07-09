/**
 * 読了時間の換算レート（字/分）。
 * Rust 側の推定（src-tauri/src/commands/analysis.rs の estimate_reading_minutes = 500字/分）と
 * 必ず一致させること。乖離すると分析モーダルと読書モードで異なる読了目安が表示される。
 */
export const READING_CHARS_PER_MINUTE = 500;

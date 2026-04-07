use serde::{Deserialize, Serialize};

/// アプリ設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    /// 自動字下げ ON/OFF
    pub auto_indent: bool,
    /// 自動保存 ON/OFF
    pub auto_save: bool,
    /// 自動保存間隔（秒）
    pub auto_save_interval_sec: u32,
    /// 文字数カウント表示 ON/OFF
    pub show_char_count: bool,
    /// 1行の文字数（原稿設定）
    pub chars_per_line: u32,
    /// 1ページの行数（原稿設定）
    pub lines_per_page: u32,
    /// エディタフォント
    pub editor_font: String,
    /// エディタフォントサイズ（px）
    pub editor_font_size: u32,
    /// エディタ最大幅（px、0 = 制限なし）
    #[serde(default = "default_editor_max_width")]
    pub editor_max_width: u32,
}

fn default_editor_max_width() -> u32 {
    860
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            auto_indent: true,
            auto_save: true,
            auto_save_interval_sec: 60,
            show_char_count: true,
            chars_per_line: 40,
            lines_per_page: 20,
            editor_font: "游明朝".to_string(),
            editor_font_size: 16,
            editor_max_width: 860,
        }
    }
}

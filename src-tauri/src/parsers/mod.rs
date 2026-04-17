pub mod types;
pub mod txt_parser;
pub mod md_parser;

pub use types::*;

#[derive(Debug, PartialEq)]
pub enum FileFormat {
    PlainText,
    Markdown,
}

/// ファイル内容からフォーマットを自動検出する
pub fn detect_format(content: &str) -> FileFormat {
    let mut lines = content.lines();
    // 1行目スキップ（タイトル行）
    lines.next();
    // 2行目が ==... なら TXT
    if let Some(second) = lines.next() {
        let t = second.trim();
        if !t.is_empty() && t.chars().all(|c| c == '=') {
            return FileFormat::PlainText;
        }
    }
    // 1行目が # で始まる場合は MD
    if content.trim_start().starts_with("# ") {
        return FileFormat::Markdown;
    }
    FileFormat::PlainText
}

/// ファイル内容をパースして ParsedStoryProject を返す
pub fn parse_content(content: &str) -> ParsedStoryProject {
    match detect_format(content) {
        FileFormat::Markdown => md_parser::parse(content),
        FileFormat::PlainText => txt_parser::parse(content),
    }
}

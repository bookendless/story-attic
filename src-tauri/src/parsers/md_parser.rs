use super::types::*;
use super::txt_parser::plain_to_html;

/// MD形式（# ヘッダ）をパースする
pub fn parse(content: &str) -> ParsedStoryProject {
    let lines: Vec<&str> = content.lines().collect();
    let mut project = ParsedStoryProject::default();

    // タイトル（# で始まる最初の行）
    for line in &lines {
        let t = line.trim();
        if let Some(v) = t.strip_prefix("# ") {
            if !v.starts_with('#') {
                project.title = v.trim().to_string();
                break;
            }
        }
    }

    // ## セクションで分割
    let sections = split_md_sections(&lines);

    for (header, body) in &sections {
        match header.as_str() {
            "概要" => project.overview = body.join("\n").trim().to_string(),
            "基本情報" => project.basic_info = parse_basic_info_md(body),
            "キャラクター一覧" => project.characters = parse_characters_md(body),
            "プロット" => project.plot = parse_plot_md(body),
            "あらすじ" => project.synopsis = body.join("\n").trim().to_string(),
            "章立て" => project.chapters = parse_chapters_md(body),
            "草案" => project.drafts = parse_drafts_md(body),
            "用語集" => project.glossary = parse_glossary_md(body),
            "キャラクター相関図" => project.relationships = parse_correlations_md(body),
            "世界観設定" => project.world_settings = parse_world_settings_md(body),
            "伏線トラッカー" => project.plot_threads = parse_plot_threads_md(body),
            _ => {}
        }
    }

    project
}

/// `## ヘッダ` でセクション分割する
fn split_md_sections(lines: &[&str]) -> Vec<(String, Vec<String>)> {
    let mut result = Vec::new();
    let mut current_header = String::new();
    let mut current_body: Vec<String> = Vec::new();

    for line in lines {
        let t = line.trim();
        if let Some(v) = t.strip_prefix("## ") {
            if !v.starts_with('#') {
                if !current_header.is_empty() {
                    result.push((current_header.clone(), current_body.clone()));
                }
                current_header = v.trim().to_string();
                current_body.clear();
                continue;
            }
        }
        current_body.push(line.to_string());
    }

    if !current_header.is_empty() {
        result.push((current_header, current_body));
    }

    result
}

fn parse_basic_info_md(lines: &[String]) -> ParsedBasicInfo {
    let mut info = ParsedBasicInfo::default();
    for line in lines {
        let t = strip_md_bold(line.trim());
        if let Some(v) = t.strip_prefix("メインジャンル:") {
            info.genre = v.trim().to_string();
        } else if let Some(v) = t.strip_prefix("サブジャンル:") {
            info.sub_genre = v.trim().to_string();
        } else if let Some(v) = t.strip_prefix("読者層:") {
            info.target_readers = v.trim().to_string();
        } else if let Some(v) = t.strip_prefix("プロジェクトテーマ:") {
            info.theme = v.trim().to_string();
        }
    }
    info
}

/// MD形式のキャラクターをパースする
/// `### **名前** (メタ)` or `### 名前 (メタ)` で分割
fn parse_characters_md(lines: &[String]) -> Vec<ParsedCharacter> {
    let entries = split_by_h3(lines);
    let mut chars = Vec::new();

    for (header, body) in entries {
        let clean = strip_md_formatting(&header);
        let (name, meta) = extract_name_meta_md(&clean);

        let mut char = ParsedCharacter {
            name,
            meta,
            appearance: String::new(),
            personality: String::new(),
            background: String::new(),
        };

        parse_char_fields_md(&body, &mut char);
        chars.push(char);
    }

    chars
}

fn parse_char_fields_md(lines: &[String], char: &mut ParsedCharacter) {
    let mut current_field = "";
    let mut collecting_multiline = false;

    for line in lines {
        let t = line.trim();

        // 複数行モード終了: `**` のみ or 空行
        if collecting_multiline && (t == "**" || t.is_empty()) {
            collecting_multiline = false;
            current_field = "";
            continue;
        }

        // 複数行モードの本文収集（raw textをそのまま使用）
        if collecting_multiline {
            match current_field {
                "appearance" => {
                    if !char.appearance.is_empty() { char.appearance.push('\n'); }
                    char.appearance.push_str(t);
                }
                "personality" => {
                    if !char.personality.is_empty() { char.personality.push('\n'); }
                    char.personality.push_str(t);
                }
                "background" => {
                    if !char.background.is_empty() { char.background.push('\n'); }
                    char.background.push_str(t);
                }
                _ => {}
            }
            continue;
        }

        // `**フィールド**: **` (複数行開始) or `**フィールド**: 値` (インライン)
        // strip_md_bold_markersを呼ばずrawラインを渡す（**が消えるとparse_bold_fieldが常にNoneになる）
        if let Some((field, value)) = parse_bold_field(t) {
            let val = value.trim();
            match field.as_str() {
                "外見" => {
                    if val.is_empty() || val == "**" {
                        current_field = "appearance";
                        collecting_multiline = true;
                    } else {
                        char.appearance = val.trim_matches('*').trim().to_string();
                    }
                }
                "性格" => {
                    if val.is_empty() || val == "**" {
                        current_field = "personality";
                        collecting_multiline = true;
                    } else {
                        char.personality = val.trim_matches('*').trim().to_string();
                    }
                }
                "背景" => {
                    if val.is_empty() || val == "**" {
                        current_field = "background";
                        collecting_multiline = true;
                    } else {
                        char.background = val.trim_matches('*').trim().to_string();
                    }
                }
                _ => {}
            }
        }
    }
}

fn parse_plot_md(lines: &[String]) -> ParsedPlot {
    let mut plot = ParsedPlot::default();

    for line in lines {
        let t = line.trim();
        if t.is_empty() {
            continue;
        }

        // rawラインを直接渡す（strip_md_bold_markersで**を除去すると検出不可になる）
        if let Some((field, value)) = parse_bold_field(t) {
            let val = value.trim().trim_matches('*').trim().to_string();
            match field.as_str() {
                "テーマ" => plot.theme = val,
                "舞台" => plot.setting = val,
                "フック" => plot.hook = val,
                "主人公の目標" => plot.protagonist_goal = val,
                "主要な障害" => plot.main_obstacles = val,
                "物語の結末" => plot.ending = val,
                "プロット構成形式" => plot.structure_type = val,
                _ => {
                    // フェーズ: `第N幕（...）` など
                    if field.starts_with('第') || field.contains('幕') {
                        plot.phases.push(ParsedPlotPhase {
                            label: field,
                            content: val,
                        });
                    }
                }
            }
        }
    }

    plot
}

fn parse_chapters_md(lines: &[String]) -> Vec<ParsedChapter> {
    let entries = split_by_h3(lines);
    let mut chapters = Vec::new();

    for (header, body) in entries {
        let clean = strip_md_formatting(&header);
        let (number, title) = parse_chapter_header(&clean);
        let summary = body
            .iter()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty())
            .collect::<Vec<_>>()
            .join("\n");

        chapters.push(ParsedChapter { number, title, summary });
    }

    chapters
}

/// MD草案セクション: `## 章タイトル` で各ドラフトを分割
fn parse_drafts_md(lines: &[String]) -> Vec<ParsedDraft> {
    let mut drafts = Vec::new();
    let mut current_ref: Option<String> = None;
    let mut current_body: Vec<String> = Vec::new();

    for line in lines {
        let t = line.trim();
        if let Some(v) = t.strip_prefix("## ") {
            if !v.starts_with('#') {
                if !current_body.is_empty() {
                    let body_text = current_body.join("\n");
                    drafts.push(ParsedDraft {
                        chapter_ref: current_ref.clone(),
                        body: plain_to_html(&body_text),
                    });
                    current_body.clear();
                }
                current_ref = Some(v.trim().to_string());
                continue;
            }
        }
        current_body.push(line.to_string());
    }

    if !current_body.is_empty() {
        let body_text = current_body.join("\n");
        drafts.push(ParsedDraft {
            chapter_ref: current_ref,
            body: plain_to_html(&body_text),
        });
    }

    drafts
}

/// 用語集パース
fn parse_glossary_md(lines: &[String]) -> Vec<ParsedGlossaryItem> {
    let entries = split_by_h3(lines);
    let mut items = Vec::new();

    for (header, body) in entries {
        let clean = strip_md_formatting(&header);
        // `用語 (読み) [タイプ]` or `用語 [タイプ]`
        let (term, reading, term_type) = parse_glossary_header(&clean);
        let mut definition = String::new();

        for line in &body {
            let t = line.trim();
            if let Some((field, value)) = parse_bold_field(t) {
                if field == "定義" || field == "説明" {
                    definition = value.trim().trim_matches('*').trim().to_string();
                }
            } else if !t.is_empty() && !t.starts_with('#') && definition.is_empty() {
                definition = strip_md_formatting(t);
            }
        }

        items.push(ParsedGlossaryItem { term, reading, term_type, definition });
    }

    items
}

/// キャラクター相関図パース
/// `### From → To` で分割、`**関係性**: type (強度: N/10)` 等
fn parse_correlations_md(lines: &[String]) -> Vec<ParsedRelationship> {
    let entries = split_by_h3(lines);
    let mut rels = Vec::new();

    for (header, body) in entries {
        let clean = strip_md_formatting(&header);
        let (from_name, to_name) = parse_relation_header(&clean);
        if from_name.is_empty() || to_name.is_empty() {
            continue;
        }

        let mut relation_type = String::new();
        let mut intensity = 5i32;
        let mut description = String::new();
        let mut notes = String::new();

        for line in &body {
            let t = line.trim();
            if let Some((field, value)) = parse_bold_field(t) {
                let val = value.trim().trim_matches('*').trim();
                match field.as_str() {
                    "関係性" => {
                        // "mentor (強度: 4/10)" → type="mentor", intensity=4
                        let (rt, int) = parse_relation_type_intensity(val);
                        relation_type = rt;
                        intensity = int;
                    }
                    "説明" => description = val.to_string(),
                    "備考" => notes = val.to_string(),
                    _ => {}
                }
            }
        }

        rels.push(ParsedRelationship {
            from_name,
            to_name,
            relation_type,
            intensity,
            description,
            notes,
        });
    }

    rels
}

/// 世界観設定パース
fn parse_world_settings_md(lines: &[String]) -> Vec<ParsedWorldSetting> {
    let entries = split_by_h3(lines);
    let mut items = Vec::new();

    for (header, body) in entries {
        let clean = strip_md_formatting(&header);
        let (title, category) = parse_world_setting_header(&clean);
        let content = body
            .iter()
            .map(|l| strip_md_formatting(l.trim()))
            .filter(|l| !l.is_empty())
            .collect::<Vec<_>>()
            .join("\n");

        items.push(ParsedWorldSetting { title, category, content });
    }

    items
}

/// 伏線トラッカーパース
fn parse_plot_threads_md(lines: &[String]) -> Vec<ParsedPlotThread> {
    let entries = split_by_h3(lines);
    let mut threads = Vec::new();

    for (header, body) in entries {
        let clean = strip_md_formatting(&header);
        let (title, category) = parse_plot_thread_header(&clean);

        let mut pt = ParsedPlotThread {
            title,
            category,
            ..Default::default()
        };

        for line in &body {
            let t = line.trim();
            if let Some((field, value)) = parse_bold_field(t) {
                let val = value.trim().trim_matches('*').trim().to_string();
                match field.as_str() {
                    "ステータス" => pt.status = val,
                    "重要度" => pt.importance = val,
                    "説明" => pt.description = val,
                    "関連キャラクター" => {
                        pt.related_characters = val.split('、')
                            .chain(val.split(','))
                            .map(|s| s.trim().to_string())
                            .filter(|s| !s.is_empty())
                            .collect();
                    }
                    "回収予定方法" | "解決方法" => pt.resolution = val,
                    "設置推奨" => pt.recommended_placement = val,
                    "期待効果" => pt.expected_effect = val,
                    "メモ" | "備考" => pt.notes = val,
                    _ => {}
                }
            }
        }

        threads.push(pt);
    }

    threads
}

// ============================================================
// ヘルパー関数
// ============================================================

/// `### ` で行を分割し、(header, body_lines) のペアを返す
fn split_by_h3(lines: &[String]) -> Vec<(String, Vec<String>)> {
    let mut result = Vec::new();
    let mut current_header = String::new();
    let mut current_body: Vec<String> = Vec::new();

    for line in lines {
        let t = line.trim();
        if let Some(v) = t.strip_prefix("### ") {
            if !current_header.is_empty() {
                result.push((current_header.clone(), current_body.clone()));
            }
            current_header = v.trim().to_string();
            current_body.clear();
        } else {
            current_body.push(line.to_string());
        }
    }

    if !current_header.is_empty() {
        result.push((current_header, current_body));
    }

    result
}

/// `**フィールド**: 値` から (フィールド名, 値) を抽出する
/// rawライン（**マーカー付き）を受け取る
fn parse_bold_field(s: &str) -> Option<(String, String)> {
    let s = s.trim();
    if !s.starts_with("**") {
        return None;
    }
    // 先頭の ** を除去
    let s = &s[2..];
    let colon_pos = s.find(':')?;
    let field = s[..colon_pos].trim_end_matches('*').trim().to_string();
    let value = s[colon_pos + 1..].to_string();
    if field.is_empty() {
        return None;
    }
    Some((field, value))
}

/// MDフォーマット全般を除去する（**, *, _）
fn strip_md_formatting(s: &str) -> String {
    s.replace("**", "").replace(['*', '_'], "")
}

/// `**テキスト**` などのボールドを除去してプレーンテキストを返す
fn strip_md_bold(s: &str) -> String {
    s.replace("**", "")
}

/// `名前 (メタ)` からMDフォーマット済み文字列をパースする
fn extract_name_meta_md(s: &str) -> (String, String) {
    if let Some(pos) = s.find('(').or_else(|| s.find('（')) {
        let name = s[..pos].trim().to_string();
        let rest = &s[pos..];
        let meta = rest
            .trim_start_matches('(')
            .trim_start_matches('（')
            .trim_end_matches(')')
            .trim_end_matches('）')
            .trim()
            .to_string();
        (name, meta)
    } else {
        (s.trim().to_string(), String::new())
    }
}

/// `第N章: タイトル` を (number, title) に分解する
fn parse_chapter_header(s: &str) -> (i32, String) {
    if let Some(colon_pos) = s.find(':').or_else(|| s.find('：')) {
        let chapter_part = &s[..colon_pos];
        let title = s[colon_pos + 1..].trim().to_string();
        let number = extract_chapter_number(chapter_part);
        (number, title)
    } else {
        (0, s.to_string())
    }
}

/// `用語 (読み) [タイプ]` をパース
fn parse_glossary_header(s: &str) -> (String, String, String) {
    let mut term = s.trim().to_string();
    let mut reading = String::new();
    let mut term_type = String::new();

    if let Some(bracket_start) = term.rfind('[') {
        if let Some(bracket_end) = term.rfind(']') {
            term_type = term[bracket_start + 1..bracket_end].trim().to_string();
            term = term[..bracket_start].trim().to_string();
        }
    }
    if let Some(paren_start) = term.find('(').or_else(|| term.find('（')) {
        let paren_end = term.find(')').or_else(|| term.find('）')).unwrap_or(term.len());
        reading = term[paren_start + 1..paren_end].trim().to_string();
        term = term[..paren_start].trim().to_string();
    }

    (term, reading, term_type)
}

/// `From → To` or `From → To` をパース
fn parse_relation_header(s: &str) -> (String, String) {
    if let Some(pos) = s.find('→') {
        let from = s[..pos].trim().to_string();
        let to_bytes = pos + '→'.len_utf8();
        let to = s[to_bytes..].trim().to_string();
        (from, to)
    } else {
        (String::new(), String::new())
    }
}

/// `"mentor (強度: 4/10)"` → (`"mentor"`, 4)
fn parse_relation_type_intensity(s: &str) -> (String, i32) {
    let s = s.trim();
    if let Some(paren_pos) = s.find('(') {
        let rel_type = s[..paren_pos].trim().to_string();
        let intensity = s[paren_pos..]
            .chars()
            .filter(|c| c.is_ascii_digit())
            .take(2)
            .collect::<String>()
            .parse::<i32>()
            .unwrap_or(5);
        (rel_type, intensity)
    } else {
        (s.to_string(), 5)
    }
}

/// `タイトル [カテゴリ]` → (title, category)
fn parse_world_setting_header(s: &str) -> (String, String) {
    if let Some(bracket_start) = s.rfind('[') {
        if let Some(bracket_end) = s.rfind(']') {
            let category = s[bracket_start + 1..bracket_end].trim().to_string();
            let title = s[..bracket_start].trim().to_string();
            return (title, category);
        }
    }
    (s.trim().to_string(), String::new())
}

/// `タイトル [カテゴリ]` or `タイトル` → (title, category) (伏線用)
fn parse_plot_thread_header(s: &str) -> (String, String) {
    parse_world_setting_header(s)
}

fn extract_chapter_number(s: &str) -> i32 {
    let s = s.replace(['第', '章'], "");
    let s = to_arabic_number(s.trim());
    s.parse().unwrap_or(0)
}

fn to_arabic_number(s: &str) -> String {
    s.chars().map(|c| match c {
        '１' => '1', '２' => '2', '３' => '3', '４' => '4', '５' => '5',
        '６' => '6', '７' => '7', '８' => '8', '９' => '9', '０' => '0',
        '一' => '1', '二' => '2', '三' => '3', '四' => '4', '五' => '5',
        '六' => '6', '七' => '7', '八' => '8', '九' => '9',
        _ => c,
    }).collect()
}


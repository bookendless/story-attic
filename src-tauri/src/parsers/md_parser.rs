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
            "タイムライン" => project.timeline = parse_timeline_md(body),
            _ => {}
        }
    }

    project
}

/// AI Story Builder MD の既知トップレベルセクション名。
/// `## XXX` のうちこのリストに含まれるもののみセクション境界として扱い、
/// それ以外（例: `## 閃光の出会い`）は現セクションの本文として保持する。
const TOP_LEVEL_SECTIONS: &[&str] = &[
    "概要",
    "基本情報",
    "キャラクター一覧",
    "プロット",
    "あらすじ",
    "章立て",
    "草案",
    "用語集",
    "キャラクター相関図",
    "世界観設定",
    "伏線トラッカー",
    "タイムライン",
];

/// `## ヘッダ` でセクション分割する（既知ヘッダ名のみを境界とする）
fn split_md_sections(lines: &[&str]) -> Vec<(String, Vec<String>)> {
    let mut result = Vec::new();
    let mut current_header = String::new();
    let mut current_body: Vec<String> = Vec::new();

    for line in lines {
        let t = line.trim();
        if let Some(v) = t.strip_prefix("## ") {
            if !v.starts_with('#') {
                let name = v.trim().trim_end_matches('*').trim().to_string();
                if TOP_LEVEL_SECTIONS.contains(&name.as_str()) {
                    if !current_header.is_empty() {
                        result.push((current_header.clone(), current_body.clone()));
                    }
                    current_header = name;
                    current_body.clear();
                    continue;
                }
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
                    // 既知フィールド以外はフェーズ扱い（ヒーローズ・ジャーニーの「日常の世界」「冒険への誘い」等）
                    plot.phases.push(ParsedPlotPhase {
                        label: field,
                        content: val,
                    });
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

        let mut summary = String::new();
        let mut setting = String::new();
        let mut mood = String::new();
        let mut important_events = String::new();
        let mut current_field = "";

        for line in &body {
            let t = line.trim();
            if t.is_empty() {
                continue;
            }

            if let Some((field, value)) = parse_bold_field(t) {
                let val = value.trim().trim_matches('*').trim().to_string();
                match field.as_str() {
                    "あらすじ" => {
                        current_field = "summary";
                        summary = val;
                    }
                    "設定・場所" => {
                        current_field = "setting";
                        setting = val;
                    }
                    "雰囲気・ムード" => {
                        current_field = "mood";
                        mood = val;
                    }
                    "重要な出来事" => {
                        current_field = "events";
                    }
                    _ => {}
                }
            } else {
                let buf = match current_field {
                    "summary" => &mut summary,
                    "setting" => &mut setting,
                    "mood" => &mut mood,
                    "events" => &mut important_events,
                    _ => continue,
                };
                if !buf.is_empty() {
                    buf.push('\n');
                }
                buf.push_str(t);
            }
        }

        chapters.push(ParsedChapter {
            number,
            title,
            summary: summary.trim().to_string(),
            setting: setting.trim().to_string(),
            mood: mood.trim().to_string(),
            important_events: important_events.trim().to_string(),
        });
    }

    chapters
}

/// MD草案セクション: `## 章タイトル` または `### 第N章…` で各ドラフトを分割。
/// 同一章ヘッダが二重に現れる場合（`### 第1章: …**` の直下に `### 第一章 …`）は、
/// 直前の draft が空ならヘッダだけ更新する（重複ヘッダ吸収）。
fn parse_drafts_md(lines: &[String]) -> Vec<ParsedDraft> {
    let mut drafts: Vec<ParsedDraft> = Vec::new();
    let mut current_ref: Option<String> = None;
    let mut current_body: Vec<String> = Vec::new();

    let push_draft = |chapter_ref: &Option<String>,
                      body: &[String],
                      drafts: &mut Vec<ParsedDraft>| {
        let joined = body.join("\n");
        if joined.trim().is_empty() {
            return;
        }
        drafts.push(ParsedDraft {
            chapter_ref: chapter_ref.clone(),
            body: plain_to_html(&joined),
        });
    };

    for line in lines {
        let t = line.trim();

        // `### …` を優先で章ヘッダ判定
        if let Some(v) = t.strip_prefix("### ") {
            push_draft(&current_ref, &current_body, &mut drafts);
            current_body.clear();
            current_ref = Some(normalize_chapter_ref(v.trim()));
            continue;
        }
        // `## …`（既に split_md_sections で TOP_LEVEL は除かれているので章タイトル想定）
        if let Some(v) = t.strip_prefix("## ") {
            if !v.starts_with('#') {
                push_draft(&current_ref, &current_body, &mut drafts);
                current_body.clear();
                current_ref = Some(normalize_chapter_ref(v.trim()));
                continue;
            }
        }
        current_body.push(line.to_string());
    }

    push_draft(&current_ref, &current_body, &mut drafts);

    // 連続する同一 chapter_ref を統合（重複ヘッダ吸収）
    let mut merged: Vec<ParsedDraft> = Vec::new();
    for d in drafts {
        if let Some(last) = merged.last_mut() {
            if last.chapter_ref == d.chapter_ref && d.chapter_ref.is_some() {
                last.body.push('\n');
                last.body.push_str(&d.body);
                continue;
            }
        }
        merged.push(d);
    }
    merged
}

/// 章タイトルを正規化する。
/// - 末尾の `**` 等の Markdown 装飾を除去
/// - 全角コロン `：` を半角 `:` に
/// - 漢数字を含む `第一章 タイトル` 形式は `第N章: タイトル` に正規化（簡易）
fn normalize_chapter_ref(s: &str) -> String {
    let mut t = s.trim().trim_end_matches('*').trim().to_string();
    t = t.replace('：', ":");
    // `第一章 ...` → `第1章: ...` （漢数字対応）
    if let Some(rest) = t.strip_prefix('第') {
        if let Some(kanji_end) = rest.find('章') {
            let num_part = &rest[..kanji_end];
            if let Some(n) = kanji_to_num(num_part) {
                let after = rest[kanji_end + '章'.len_utf8()..].trim();
                let after = after.trim_start_matches(':').trim();
                if after.is_empty() {
                    return format!("第{}章", n);
                }
                return format!("第{}章: {}", n, after);
            }
        }
    }
    t
}

/// 漢数字 / 算用数字を i32 に変換する簡易関数（1〜99 程度を想定）
fn kanji_to_num(s: &str) -> Option<i32> {
    let s = s.trim();
    if s.is_empty() {
        return None;
    }
    if let Ok(n) = s.parse::<i32>() {
        return Some(n);
    }
    let digit = |c: char| -> Option<i32> {
        match c {
            '〇' | '零' => Some(0),
            '一' => Some(1),
            '二' => Some(2),
            '三' => Some(3),
            '四' => Some(4),
            '五' => Some(5),
            '六' => Some(6),
            '七' => Some(7),
            '八' => Some(8),
            '九' => Some(9),
            _ => None,
        }
    };
    let chars: Vec<char> = s.chars().collect();
    match chars.as_slice() {
        ['十'] => Some(10),
        ['十', b] => digit(*b).map(|n| 10 + n),
        [a, '十'] => digit(*a).map(|n| n * 10),
        [a, '十', b] => match (digit(*a), digit(*b)) {
            (Some(x), Some(y)) => Some(x * 10 + y),
            _ => None,
        },
        [c] => digit(*c),
        _ => None,
    }
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
/// `### タイトル` で分割。配下に bold-field（`**カテゴリ**:` 等）、`#### ポイント` のリスト、
/// bold無しの `設置推奨:`/`期待効果:` などが混在する。
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

        let mut in_points = false;
        let mut description_lines: Vec<String> = Vec::new();
        let mut description_set_via_field = false;

        for line in &body {
            let t = line.trim();

            // サマリー以降は無視
            if t.contains("伏線サマリー") {
                break;
            }
            if t.is_empty() {
                continue;
            }

            // `#### ポイント` セクションマーカー
            if let Some(v) = t.strip_prefix("#### ") {
                in_points = v.trim() == "ポイント" || v.trim().starts_with("ポイント");
                continue;
            }
            if t.starts_with('#') {
                // 想定外の見出しは無視
                in_points = false;
                continue;
            }

            // ポイントモード中のリスト行: `- **📍設置**: 本文 (章タイトル)`
            if in_points && t.starts_with('-') {
                let cleaned = t.trim_start_matches('-').trim();
                if let Some(point) = parse_md_point_line(cleaned) {
                    pt.points.push(point);
                }
                continue;
            }

            // bold-field 行: `**フィールド**: 値`
            if let Some((field, value)) = parse_bold_field(t) {
                in_points = false;
                let val = value.trim().trim_matches('*').trim().to_string();
                match field.as_str() {
                    "カテゴリ" => {
                        if pt.category.is_empty() {
                            pt.category = val;
                        }
                    }
                    "ステータス" => pt.status = val,
                    "重要度" => pt.importance = val,
                    "説明" => {
                        pt.description = val;
                        description_set_via_field = true;
                    }
                    "関連キャラクター" => {
                        pt.related_characters = val
                            .split(['、', ','])
                            .map(|s| s.trim().to_string())
                            .filter(|s| !s.is_empty())
                            .collect();
                    }
                    "回収予定方法" | "解決方法" => pt.resolution = val,
                    "回収予定章" => pt.recovery_chapter = val,
                    "設置推奨" => pt.recommended_placement = val,
                    "期待効果" => pt.expected_effect = val,
                    "メモ" | "備考" => pt.notes = val,
                    _ => {}
                }
                continue;
            }

            // bold 無し prefix 行（`**メモ**: …` の直後に続く `設置推奨:` `期待効果:` など）
            if let Some(v) = t.strip_prefix("設置推奨:") {
                pt.recommended_placement = v.trim().to_string();
                continue;
            }
            if let Some(v) = t.strip_prefix("期待効果:") {
                pt.expected_effect = v.trim().to_string();
                continue;
            }
            if let Some(v) = t.strip_prefix("メモ:") {
                if pt.notes.is_empty() {
                    pt.notes = v.trim().to_string();
                }
                continue;
            }

            // 上記いずれでもない非空行は description 段落として収集
            if !description_set_via_field {
                description_lines.push(strip_md_formatting(t));
            }
        }

        if !description_set_via_field && !description_lines.is_empty() {
            pt.description = description_lines.join("\n").trim().to_string();
        }

        threads.push(pt);
    }

    threads
}

/// `**📍設置**: 本文 (章タイトル)` 形式のリスト行を解析する。
/// 末尾が `(…)` で閉じている場合のみ chapter として切り出す。
fn parse_md_point_line(s: &str) -> Option<ParsedPlotThreadPoint> {
    let s = s.trim();

    // `**フィールド**: 値` の形を前提に bold を剥がす
    let stripped = strip_md_bold(s);
    let stripped = stripped.trim().trim_start_matches('📍').trim();

    let colon_pos = stripped.find(':').or_else(|| stripped.find('：'))?;
    let point_type = stripped[..colon_pos]
        .trim()
        .trim_start_matches('📍')
        .trim()
        .to_string();
    let rest = stripped[colon_pos + ':'.len_utf8()..].trim();

    // 末尾の `(章タイトル)` を抽出
    let (content, chapter) = if rest.ends_with(')') || rest.ends_with('）') {
        let close = rest.chars().count() - 1;
        let close_byte = rest
            .char_indices()
            .nth(close)
            .map(|(i, _)| i)
            .unwrap_or(rest.len());
        let open_byte = rest.rfind('(').or_else(|| rest.rfind('（'));
        if let Some(open) = open_byte {
            if open < close_byte {
                let chapter = rest[open + 1..close_byte].trim().to_string();
                let content = rest[..open].trim().to_string();
                (content, chapter)
            } else {
                (rest.to_string(), String::new())
            }
        } else {
            (rest.to_string(), String::new())
        }
    } else {
        (rest.to_string(), String::new())
    };

    if point_type.is_empty() && content.is_empty() {
        return None;
    }

    Some(ParsedPlotThreadPoint {
        point_type,
        chapter,
        content,
    })
}

/// タイムラインパース
/// `### N. タイトル [カテゴリ]` で分割、配下に `**日付**:` `**関連キャラクター**:` フィールド、
/// その他の段落はすべて description として集約する。
fn parse_timeline_md(lines: &[String]) -> Vec<ParsedTimelineEvent> {
    let entries = split_by_h3(lines);
    let mut events = Vec::new();

    for (header, body) in entries {
        let clean = strip_md_formatting(&header);
        let (number, title, category) = parse_timeline_header(&clean);

        let mut event = ParsedTimelineEvent {
            number,
            title,
            category,
            ..Default::default()
        };

        let mut description_lines: Vec<String> = Vec::new();

        for line in &body {
            let t = line.trim();
            if t.is_empty() {
                continue;
            }
            if let Some((field, value)) = parse_bold_field(t) {
                let val = value.trim().trim_matches('*').trim().to_string();
                match field.as_str() {
                    "日付" => event.date = val,
                    "関連キャラクター" => {
                        event.related_characters = val
                            .split(['、', ','])
                            .map(|s| s.trim().to_string())
                            .filter(|s| !s.is_empty())
                            .collect();
                    }
                    "説明" => description_lines.push(val),
                    _ => {}
                }
            } else if !t.starts_with('#') {
                description_lines.push(strip_md_formatting(t));
            }
        }

        event.description = description_lines.join("\n").trim().to_string();
        events.push(event);
    }

    events
}

/// `0. タイトル [カテゴリ]` または `タイトル [カテゴリ]` をパース
fn parse_timeline_header(s: &str) -> (i32, String, String) {
    let mut rest = s.trim().to_string();

    // 先頭の `N.` を抽出
    let mut number = 0i32;
    if let Some(dot_pos) = rest.find('.') {
        let head = rest[..dot_pos].trim();
        if let Ok(n) = head.parse::<i32>() {
            number = n;
            rest = rest[dot_pos + 1..].trim().to_string();
        }
    }

    // 末尾の `[カテゴリ]` を抽出
    let mut category = String::new();
    if let Some(b_start) = rest.rfind('[') {
        if let Some(b_end) = rest.rfind(']') {
            if b_start < b_end {
                category = rest[b_start + 1..b_end].trim().to_string();
                rest = rest[..b_start].trim().to_string();
            }
        }
    }

    (number, rest, category)
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
/// `/` 以降は無視し、最初に現れる連続した数字列のみを取得して 0-10 にクランプ。
fn parse_relation_type_intensity(s: &str) -> (String, i32) {
    let s = s.trim();
    let Some(paren_pos) = s.find('(') else {
        return (s.to_string(), 5);
    };
    let rel_type = s[..paren_pos].trim().to_string();
    let tail = &s[paren_pos..];
    let after = tail.find(':').map(|p| &tail[p + 1..]).unwrap_or(tail);

    let mut digits = String::new();
    for c in after.chars() {
        if c.is_ascii_digit() {
            digits.push(c);
        } else if !digits.is_empty() {
            break;
        }
    }
    let intensity = digits.parse::<i32>().unwrap_or(5).clamp(0, 10);
    (rel_type, intensity)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn intensity_simple() {
        assert_eq!(parse_relation_type_intensity("friend (強度: 5/10)").1, 5);
    }

    #[test]
    fn intensity_clamped_when_oversize() {
        assert_eq!(parse_relation_type_intensity("ally (強度: 99/10)").1, 10);
    }

    #[test]
    fn intensity_no_paren_default() {
        assert_eq!(parse_relation_type_intensity("mentor").1, 5);
    }

    #[test]
    fn drafts_md_splits_by_h2() {
        let input: Vec<String> = ["## 章A", "本文A", "## 章B", "本文B"]
            .iter()
            .map(|s| s.to_string())
            .collect();
        let drafts = parse_drafts_md(&input);
        assert_eq!(drafts.len(), 2);
        assert_eq!(drafts[0].chapter_ref.as_deref(), Some("章A"));
        assert_eq!(drafts[1].chapter_ref.as_deref(), Some("章B"));
    }

    #[test]
    fn drafts_md_splits_by_h3_chapter() {
        let input: Vec<String> = [
            "### 第1章: 導入**",
            "本文1。",
            "### 第一章 導入",
            "追記1。",
            "### 第2章: 展開**",
            "本文2。",
        ]
        .iter()
        .map(|s| s.to_string())
        .collect();
        let drafts = parse_drafts_md(&input);
        // 重複ヘッダ吸収で 2 件
        assert_eq!(drafts.len(), 2);
        assert_eq!(drafts[0].chapter_ref.as_deref(), Some("第1章: 導入"));
        assert!(drafts[0].body.contains("本文1"));
        assert!(drafts[0].body.contains("追記1"));
        assert_eq!(drafts[1].chapter_ref.as_deref(), Some("第2章: 展開"));
    }

    #[test]
    fn timeline_md_parses_entries() {
        let lines: Vec<String> = [
            "### 0. 出会い [plot]",
            "",
            "**日付**: 第1章",
            "",
            "ルナとロイが路地裏で出会う。",
            "",
            "**関連キャラクター**: ルナ, ロイ",
            "",
            "### 1. 包囲網 [plot]",
            "",
            "**日付**: 第2章",
            "",
            "シリウスの部隊が屋敷を包囲する。",
            "",
            "**関連キャラクター**: ロイ、シリウス",
        ]
        .iter()
        .map(|s| s.to_string())
        .collect();
        let events = parse_timeline_md(&lines);
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].number, 0);
        assert_eq!(events[0].title, "出会い");
        assert_eq!(events[0].category, "plot");
        assert_eq!(events[0].date, "第1章");
        assert!(events[0].description.contains("出会う"));
        assert_eq!(events[0].related_characters.len(), 2);
        assert_eq!(events[1].related_characters, vec!["ロイ", "シリウス"]);
    }

    #[test]
    fn plot_md_collects_non_canonical_phases() {
        let lines: Vec<String> = [
            "**テーマ**: テスト",
            "**プロット構成形式**: ヒーローズ・ジャーニー",
            "**日常の世界**: 平穏",
            "**冒険への誘い**: 招集",
            "**境界越え**: 旅立ち",
        ]
        .iter()
        .map(|s| s.to_string())
        .collect();
        let plot = parse_plot_md(&lines);
        assert_eq!(plot.phases.len(), 3);
        assert_eq!(plot.phases[0].label, "日常の世界");
        assert_eq!(plot.phases[1].label, "冒険への誘い");
        assert_eq!(plot.phases[2].label, "境界越え");
    }

    #[test]
    fn plot_threads_md_parses_full_entry() {
        let lines: Vec<String> = [
            "### 転生者の鼻歌と失われた子守唄",
            "",
            "**カテゴリ**: キャラクター",
            "",
            "**ステータス**: 設置済み",
            "",
            "**重要度**: ★★★高",
            "",
            "ロイが転生前の地球のポップスを鼻歌で歌う伏線。",
            "",
            "#### ポイント",
            "",
            "- **📍設置**: ロイが「最新ヒット曲」を口ずさむ。",
            "",
            "**関連キャラクター**: ロイ",
            "",
            "**回収予定章**: 心という名の存在証明",
            "",
            "**回収予定方法**: ルナがその歌を歌うトリガー。",
            "",
            "**メモ**: AI提案から作成",
            "設置推奨: 第1章 - ロイが口ずさむ。",
            "期待効果: エモーショナルな展開を生む。",
            "",
            "> **伏線サマリー**: 全1件 / 回収済み0件",
        ]
        .iter()
        .map(|s| s.to_string())
        .collect();
        let threads = parse_plot_threads_md(&lines);
        assert_eq!(threads.len(), 1);
        let t = &threads[0];
        assert_eq!(t.title, "転生者の鼻歌と失われた子守唄");
        assert_eq!(t.category, "キャラクター");
        assert_eq!(t.status, "設置済み");
        assert_eq!(t.importance, "★★★高");
        assert!(t.description.contains("鼻歌で歌う伏線"));
        assert_eq!(t.points.len(), 1);
        assert_eq!(t.points[0].point_type, "設置");
        assert_eq!(t.points[0].chapter, "路地裏の自称・人間と、逃亡癖の王女様");
        assert!(t.points[0].content.contains("ヒット曲"));
        assert_eq!(t.related_characters, vec!["ロイ"]);
        assert_eq!(t.recovery_chapter, "心という名の存在証明");
        assert!(t.resolution.contains("ルナ"));
        assert_eq!(t.notes, "AI提案から作成");
        assert!(t.recommended_placement.contains("第1章"));
        assert!(t.expected_effect.contains("エモーショナル"));
    }

    #[test]
    fn split_md_sections_keeps_unknown_h2_in_body() {
        let lines = vec!["## 草案", "## 閃光の出会い", "本文", "## 用語集", "用語1"];
        let secs = split_md_sections(&lines);
        // 草案セクションに `## 閃光の出会い` が含まれる
        let drafts_sec = secs.iter().find(|(h, _)| h == "草案").unwrap();
        assert!(drafts_sec.1.iter().any(|l| l.contains("閃光の出会い")));
        // 用語集は別セクション
        assert!(secs.iter().any(|(h, _)| h == "用語集"));
    }
}


use super::types::*;

/// TXT形式（====ヘッダ、----セクション区切り）をパースする
pub fn parse(content: &str) -> ParsedStoryProject {
    let lines: Vec<&str> = content.lines().collect();
    let mut project = ParsedStoryProject::default();

    // タイトル（1行目）
    if let Some(first) = lines.first() {
        project.title = first.trim().to_string();
    }

    // 概要（"概要: " で始まる行）
    for line in &lines {
        let t = line.trim();
        if let Some(v) = t.strip_prefix("概要:") {
            project.overview = v.trim().to_string();
            break;
        }
    }

    // セクション分割
    let sections = split_sections(&lines);

    for (header, body) in &sections {
        match header.as_str() {
            "基本情報" => project.basic_info = parse_basic_info(body),
            "キャラクター一覧" => project.characters = parse_characters_txt(body),
            "プロット" => project.plot = parse_plot_txt(body),
            "あらすじ" => project.synopsis = body.join("\n").trim().to_string(),
            "章立て" => project.chapters = parse_chapters_txt(body),
            "草案" => project.drafts = parse_drafts_txt(body),
            "用語集" => project.glossary = parse_glossary_txt(body),
            "キャラクター相関図" => project.relationships = parse_relationships_txt(body),
            "世界観設定" => project.world_settings = parse_world_settings_txt(body),
            "伏線トラッカー" => project.plot_threads = parse_plot_threads_txt(body),
            _ => {}
        }
    }

    project
}

/// セクションを分割する。`ヘッダ名\n----...` パターンで区切る
fn split_sections(lines: &[&str]) -> Vec<(String, Vec<String>)> {
    let mut result = Vec::new();
    let mut i = 0;

    while i < lines.len() {
        // `----` 行の直前行をヘッダとして検出
        if i + 1 < lines.len() && lines[i + 1].trim_start_matches('-').is_empty()
            && lines[i + 1].len() >= 4
        {
            let header = lines[i].trim().to_string();
            i += 2; // ヘッダと ---- をスキップ

            let mut body = Vec::new();
            while i < lines.len() {
                // 次のセクションヘッダが来たら終了
                if i + 1 < lines.len()
                    && lines[i + 1].trim_start_matches('-').is_empty()
                    && lines[i + 1].len() >= 4
                    && !lines[i].trim().is_empty()
                {
                    break;
                }
                body.push(lines[i].to_string());
                i += 1;
            }
            result.push((header, body));
        } else {
            i += 1;
        }
    }

    result
}

fn parse_basic_info(lines: &[String]) -> ParsedBasicInfo {
    let mut info = ParsedBasicInfo::default();
    for line in lines {
        let t = line.trim();
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

/// TXTキャラクターパース。空行またはフルネーム行で分割
fn parse_characters_txt(lines: &[String]) -> Vec<ParsedCharacter> {
    let mut chars = Vec::new();
    let mut current: Option<ParsedCharacter> = None;
    let mut current_field = "";

    for line in lines {
        let t = line.trim();
        if t.is_empty() {
            if let Some(c) = current.take() {
                if !c.name.is_empty() {
                    chars.push(c);
                }
            }
            current_field = "";
            continue;
        }

        // キャラクター名行の検出: `(` を含み、外見:/性格:/背景: で始まらない行
        if !t.starts_with("外見:") && !t.starts_with("性格:") && !t.starts_with("背景:")
            && (t.contains('(') || t.contains('（'))
            && current.is_none()
        {
            let (name, meta) = extract_name_meta(t);
            current = Some(ParsedCharacter {
                name,
                meta,
                appearance: String::new(),
                personality: String::new(),
                background: String::new(),
            });
            current_field = "";
            continue;
        }

        if let Some(ref mut c) = current {
            if let Some(v) = t.strip_prefix("外見:") {
                current_field = "appearance";
                c.appearance = v.trim().to_string();
            } else if let Some(v) = t.strip_prefix("性格:") {
                current_field = "personality";
                c.personality = v.trim().to_string();
            } else if let Some(v) = t.strip_prefix("背景:") {
                current_field = "background";
                c.background = v.trim().to_string();
            } else {
                // 継続行
                match current_field {
                    "appearance" => {
                        c.appearance.push('\n');
                        c.appearance.push_str(t);
                    }
                    "personality" => {
                        c.personality.push('\n');
                        c.personality.push_str(t);
                    }
                    "background" => {
                        c.background.push('\n');
                        c.background.push_str(t);
                    }
                    _ => {
                        // キャラクター名行の継続（括弧なしケース）
                        if !t.starts_with('(') && !t.starts_with('（') {
                            // 次のキャラ名かもしれない: 既存をpushして新規開始
                            if !c.name.is_empty() && !c.appearance.is_empty() {
                                chars.push(c.clone());
                                let (name, meta) = extract_name_meta(t);
                                *c = ParsedCharacter {
                                    name,
                                    meta,
                                    appearance: String::new(),
                                    personality: String::new(),
                                    background: String::new(),
                                };
                                current_field = "";
                            }
                        }
                    }
                }
            }
        } else if !t.is_empty() {
            // currentがNoneで非空行 = 名前行（括弧なしケース）
            let (name, meta) = extract_name_meta(t);
            current = Some(ParsedCharacter {
                name,
                meta,
                appearance: String::new(),
                personality: String::new(),
                background: String::new(),
            });
            current_field = "";
        }
    }

    if let Some(c) = current {
        if !c.name.is_empty() {
            chars.push(c);
        }
    }

    chars
}

/// `名前 (メタ情報)` または `名前（メタ情報）` から名前とメタを分離する
fn extract_name_meta(s: &str) -> (String, String) {
    // 半角・全角括弧両対応
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

fn parse_plot_txt(lines: &[String]) -> ParsedPlot {
    let mut plot = ParsedPlot::default();
    let mut current_phase: Option<(String, String)> = None;

    // 既知のフィールドキー
    let field_keys = [
        "テーマ", "舞台", "フック", "主人公の目標", "主要な障害",
        "物語の結末", "プロット構成形式",
    ];

    let mut current_key = "";
    let mut in_phases = false;

    for line in lines {
        let t = line.trim();
        if t.is_empty() {
            if let Some((label, content)) = current_phase.take() {
                plot.phases.push(ParsedPlotPhase { label, content });
            }
            continue;
        }

        // フィールドキーチェック
        let mut matched_field = false;
        for &key in &field_keys {
            let prefix = format!("{}:", key);
            if let Some(v) = t.strip_prefix(&prefix) {
                // フェーズ収集中の場合は終了
                if let Some((label, content)) = current_phase.take() {
                    plot.phases.push(ParsedPlotPhase { label, content });
                }

                let value = v.trim().to_string();
                match key {
                    "テーマ" => { plot.theme = value; current_key = "theme"; }
                    "舞台" => { plot.setting = value; current_key = "setting"; }
                    "フック" => { plot.hook = value; current_key = "hook"; }
                    "主人公の目標" => { plot.protagonist_goal = value; current_key = "goal"; }
                    "主要な障害" => { plot.main_obstacles = value; current_key = "obstacles"; }
                    "物語の結末" => { plot.ending = value; current_key = "ending"; }
                    "プロット構成形式" => {
                        plot.structure_type = value;
                        current_key = "";
                        in_phases = true;
                    }
                    _ => {}
                }
                matched_field = true;
                break;
            }
        }

        if matched_field {
            continue;
        }

        // フェーズ行の検出（`フェーズ名（補足）:` パターン）
        if in_phases && t.contains(':') {
            // コロンの前がフェーズラベルか判定（短い行でない）
            let colon_pos = t.find(':').unwrap();
            let label_candidate = &t[..colon_pos];
            // フェーズラベルは通常15文字以下
            if label_candidate.chars().count() <= 20 && !label_candidate.contains('、') {
                // 既存フェーズを保存
                if let Some((label, content)) = current_phase.take() {
                    plot.phases.push(ParsedPlotPhase { label, content });
                }
                let phase_content = t[colon_pos + 1..].trim().to_string();
                current_phase = Some((label_candidate.trim().to_string(), phase_content));
                continue;
            }
        }

        // 継続行
        if let Some((_, ref mut content)) = current_phase {
            content.push('\n');
            content.push_str(t);
        } else {
            match current_key {
                "theme" => { plot.theme.push('\n'); plot.theme.push_str(t); }
                "setting" => { plot.setting.push('\n'); plot.setting.push_str(t); }
                "hook" => { plot.hook.push('\n'); plot.hook.push_str(t); }
                "goal" => { plot.protagonist_goal.push('\n'); plot.protagonist_goal.push_str(t); }
                "obstacles" => { plot.main_obstacles.push('\n'); plot.main_obstacles.push_str(t); }
                "ending" => { plot.ending.push('\n'); plot.ending.push_str(t); }
                _ => {}
            }
        }
    }

    if let Some((label, content)) = current_phase {
        plot.phases.push(ParsedPlotPhase { label, content });
    }

    plot
}

fn parse_chapters_txt(lines: &[String]) -> Vec<ParsedChapter> {
    let mut chapters = Vec::new();
    let mut current: Option<(i32, String, String)> = None; // (number, title, summary)

    for line in lines {
        let t = line.trim();
        if t.is_empty() {
            continue;
        }

        // `第N章: タイトル` パターン
        if t.starts_with('第') {
            if let Some((n, title, summary)) = current.take() {
                chapters.push(ParsedChapter { number: n, title, summary: summary.trim().to_string() });
            }

            // 章番号抽出
            if let Some(colon_pos) = t.find(':').or_else(|| t.find('：')) {
                let chapter_part = &t[..colon_pos];
                let number = extract_chapter_number(chapter_part);
                let title = t[colon_pos + 1..].trim().to_string();
                current = Some((number, title, String::new()));
            }
        } else if let Some((_, _, ref mut summary)) = current {
            if !summary.is_empty() {
                summary.push('\n');
            }
            summary.push_str(t);
        }
    }

    if let Some((n, title, summary)) = current {
        chapters.push(ParsedChapter { number: n, title, summary: summary.trim().to_string() });
    }

    chapters
}

/// `第N章` からN（数字）を抽出する
fn extract_chapter_number(s: &str) -> i32 {
    // 漢数字→アラビア数字対応
    let s = s.replace(['第', '章'], "");
    let s = to_arabic_number(s.trim());
    s.parse().unwrap_or(0)
}

fn to_arabic_number(s: &str) -> String {
    // 全角数字も対応
    s.chars().map(|c| match c {
        '１' => '1', '２' => '2', '３' => '3', '４' => '4', '５' => '5',
        '６' => '6', '７' => '7', '８' => '8', '９' => '9', '０' => '0',
        '一' => '1', '二' => '2', '三' => '3', '四' => '4', '五' => '5',
        '六' => '6', '七' => '7', '八' => '8', '九' => '9', '十' => '0',
        _ => c,
    }).collect()
}

fn parse_glossary_txt(lines: &[String]) -> Vec<ParsedGlossaryItem> {
    let mut items = Vec::new();
    let mut current_term = String::new();
    let mut current_reading = String::new();
    let mut current_type = String::new();
    let mut current_def = String::new();
    let mut in_def = false;

    let flush = |term: &str, reading: &str, t: &str, def: &str, items: &mut Vec<ParsedGlossaryItem>| {
        if !term.is_empty() {
            items.push(ParsedGlossaryItem {
                term: term.to_string(),
                reading: reading.to_string(),
                term_type: t.to_string(),
                definition: def.trim().to_string(),
            });
        }
    };

    for line in lines {
        let t = line.trim();
        if t.is_empty() {
            flush(&current_term, &current_reading, &current_type, &current_def, &mut items);
            current_term.clear();
            current_reading.clear();
            current_type.clear();
            current_def.clear();
            in_def = false;
            continue;
        }

        if let Some(v) = t.strip_prefix("定義:") {
            in_def = true;
            current_def = v.trim().to_string();
            continue;
        }

        if in_def {
            current_def.push('\n');
            current_def.push_str(t);
            continue;
        }

        // 用語行: `用語名 (読み) [タイプ]`
        if t.contains('[') {
            flush(&current_term, &current_reading, &current_type, &current_def, &mut items);
            current_def.clear();
            in_def = false;

            let (term, reading, term_type) = parse_glossary_header(t);
            current_term = term;
            current_reading = reading;
            current_type = term_type;
        }
    }

    flush(&current_term, &current_reading, &current_type, &current_def, &mut items);
    items
}

/// `用語名 (読み) [タイプ]` を分解する
fn parse_glossary_header(s: &str) -> (String, String, String) {
    let bracket_start = s.rfind('[').unwrap_or(s.len());
    let bracket_end = s.rfind(']').unwrap_or(s.len());
    let term_type = if bracket_start < bracket_end {
        s[bracket_start + 1..bracket_end].trim().to_string()
    } else {
        String::new()
    };

    let before_bracket = s[..bracket_start].trim();
    let (term, reading) = if before_bracket.contains('(') {
        let paren_start = before_bracket.rfind('(').unwrap();
        let paren_end = before_bracket.rfind(')').unwrap_or(before_bracket.len());
        let term = before_bracket[..paren_start].trim().to_string();
        let reading = before_bracket[paren_start + 1..paren_end].trim().to_string();
        (term, reading)
    } else if before_bracket.contains('（') {
        let paren_start = before_bracket.rfind('（').unwrap();
        let paren_end = before_bracket.rfind('）').unwrap_or(before_bracket.len());
        // '（' is 3 bytes in UTF-8
        let term = before_bracket[..paren_start].trim().to_string();
        let reading = before_bracket[paren_start + '（'.len_utf8()..paren_end].trim().to_string();
        (term, reading)
    } else {
        (before_bracket.to_string(), String::new())
    };

    (term, reading, term_type)
}

/// `名前A → 名前B [type] (強度: N/10)` パターンをパース
fn parse_relationships_txt(lines: &[String]) -> Vec<ParsedRelationship> {
    let mut rels = Vec::new();
    let mut current: Option<ParsedRelationship> = None;

    for line in lines {
        let t = line.trim();
        if t.is_empty() {
            if let Some(r) = current.take() {
                rels.push(r);
            }
            continue;
        }

        if let Some(v) = t.strip_prefix("説明:") {
            if let Some(ref mut r) = current {
                r.description = v.trim().to_string();
            }
            continue;
        }

        if let Some(v) = t.strip_prefix("備考:") {
            if let Some(ref mut r) = current {
                r.notes = v.trim().to_string();
            }
            continue;
        }

        // 相関行: `名前A → 名前B [type] (強度: N/10)`
        if t.contains('→') {
            if let Some(r) = current.take() {
                rels.push(r);
            }

            let (from, to, rel_type, intensity) = parse_relation_header(t);
            current = Some(ParsedRelationship {
                from_name: from,
                to_name: to,
                relation_type: rel_type,
                intensity,
                description: String::new(),
                notes: String::new(),
            });
        }
    }

    if let Some(r) = current {
        rels.push(r);
    }

    rels
}

fn parse_relation_header(s: &str) -> (String, String, String, i32) {
    let arrow_pos = s.find('→').unwrap();
    let from = s[..arrow_pos].trim().to_string();
    let rest = &s[arrow_pos + '→'.len_utf8()..];

    // [type] を抽出
    let bracket_start = rest.find('[').unwrap_or(rest.len());
    let bracket_end = rest.find(']').unwrap_or(rest.len());
    let rel_type = if bracket_start < bracket_end {
        rest[bracket_start + 1..bracket_end].trim().to_string()
    } else {
        String::new()
    };

    let to_part = rest[..bracket_start].trim().to_string();

    // 強度: N/10 を抽出（先頭の空白をスキップし、最初に現れる数字列のみを取得して 0-10 にクランプ）
    let intensity = if let Some(p) = rest.find("強度:") {
        let after = rest[p + "強度:".len()..].trim_start();
        let num_str: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
        num_str.parse::<i32>().unwrap_or(5).clamp(0, 10)
    } else {
        5
    };

    (from, to_part, rel_type, intensity)
}

fn parse_world_settings_txt(lines: &[String]) -> Vec<ParsedWorldSetting> {
    let mut settings = Vec::new();
    let mut current_title = String::new();
    let mut current_category = String::new();
    let mut current_content = String::new();

    let flush = |title: &str, cat: &str, content: &str, settings: &mut Vec<ParsedWorldSetting>| {
        if !title.is_empty() {
            settings.push(ParsedWorldSetting {
                title: title.to_string(),
                category: cat.to_string(),
                content: content.trim().to_string(),
            });
        }
    };

    for line in lines {
        let t = line.trim();
        if t.is_empty() {
            continue;
        }

        // `タイトル [カテゴリ]` ヘッダ行の検出。
        // 末尾が `]` で短い行のみをヘッダ扱いとし、本文に `[]` が混じる誤検知を避ける。
        if is_world_setting_header(t) {
            flush(&current_title, &current_category, &current_content, &mut settings);
            current_content.clear();

            let bracket_start = t.rfind('[').unwrap();
            let bracket_end = t.rfind(']').unwrap_or(t.len());
            current_title = t[..bracket_start].trim().to_string();
            current_category = if bracket_start < bracket_end {
                t[bracket_start + 1..bracket_end].trim().to_string()
            } else {
                String::new()
            };
        } else {
            if !current_content.is_empty() {
                current_content.push('\n');
            }
            current_content.push_str(t);
        }
    }

    flush(&current_title, &current_category, &current_content, &mut settings);
    settings
}

/// 世界観設定のヘッダ行 (`タイトル [カテゴリ]`) 判定。
/// `]` が末尾近くにあり、行全体が短い（≤80 文字）場合のみヘッダとみなす。
fn is_world_setting_header(t: &str) -> bool {
    if t.chars().count() > 80 {
        return false;
    }
    let Some(b_end) = t.rfind(']') else { return false; };
    let Some(b_start) = t.rfind('[') else { return false; };
    if b_start >= b_end {
        return false;
    }
    // `]` 後に文字があってもよいが、本文行を弾くため末尾から数文字以内に限定
    let trailing = &t[b_end + ']'.len_utf8()..];
    trailing.trim().is_empty()
}

/// TXT草案セクション: `【第N章: …】` で各ドラフトを分割
fn parse_drafts_txt(lines: &[String]) -> Vec<ParsedDraft> {
    let mut drafts = Vec::new();
    let mut current_ref: Option<String> = None;
    let mut current_body: Vec<String> = Vec::new();

    let flush = |chapter_ref: &Option<String>, body: &[String], drafts: &mut Vec<ParsedDraft>| {
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
        if let Some(header) = strip_chapter_bracket(t) {
            flush(&current_ref, &current_body, &mut drafts);
            current_body.clear();
            current_ref = Some(header);
        } else {
            current_body.push(line.to_string());
        }
    }
    flush(&current_ref, &current_body, &mut drafts);

    drafts
}

/// `【第1章: タイトル】` → `Some("第1章: タイトル")`
fn strip_chapter_bracket(t: &str) -> Option<String> {
    let inner = t.strip_prefix('【')?.strip_suffix('】')?;
    let inner = inner.trim();
    if inner.is_empty() {
        None
    } else {
        Some(inner.to_string())
    }
}

fn parse_plot_threads_txt(lines: &[String]) -> Vec<ParsedPlotThread> {
    let mut threads = Vec::new();
    let mut current = new_plot_thread();
    let mut in_points = false;
    let mut in_thread = false;

    let flush = |thread: &ParsedPlotThread, threads: &mut Vec<ParsedPlotThread>| {
        if !thread.title.is_empty() {
            threads.push(thread.clone());
        }
    };

    for line in lines {
        let t = line.trim();

        // サマリー行はスキップ
        if t.starts_with("【伏線サマリー】") {
            break;
        }

        if t.is_empty() {
            in_points = false;
            continue;
        }

        // フィールドキー
        if let Some(v) = t.strip_prefix("ステータス:") {
            current.status = v.trim().to_string();
            in_points = false;
            continue;
        }
        if let Some(v) = t.strip_prefix("重要度:") {
            current.importance = v.trim().to_string();
            in_points = false;
            continue;
        }
        if let Some(v) = t.strip_prefix("説明:") {
            current.description = v.trim().to_string();
            in_points = false;
            continue;
        }
        if t == "ポイント:" || t.starts_with("ポイント:") {
            in_points = true;
            continue;
        }
        if let Some(v) = t.strip_prefix("関連キャラクター:") {
            current.related_characters = v.split(',').map(|s| s.trim().to_string()).collect();
            in_points = false;
            continue;
        }
        if let Some(v) = t.strip_prefix("回収予定方法:") {
            current.resolution = v.trim().to_string();
            in_points = false;
            continue;
        }
        if let Some(v) = t.strip_prefix("メモ:") {
            current.notes = v.trim().to_string();
            in_points = false;
            continue;
        }
        if let Some(v) = t.strip_prefix("設置推奨:") {
            current.recommended_placement = v.trim().to_string();
            in_points = false;
            continue;
        }
        if let Some(v) = t.strip_prefix("期待効果:") {
            current.expected_effect = v.trim().to_string();
            in_points = false;
            continue;
        }

        // ポイント行: `  - 📍設置: ...`
        if in_points && (t.starts_with('-') || t.contains('📍')) {
            let cleaned = t.trim_start_matches('-').trim();
            let (pt, ch, content) = parse_plot_thread_point(cleaned);
            current.points.push(ParsedPlotThreadPoint { point_type: pt, chapter: ch, content });
            continue;
        }

        // タイトル行: `タイトル [カテゴリ]` パターン
        if t.contains('[') && t.contains(']') {
            if in_thread {
                flush(&current, &mut threads);
            }
            current = new_plot_thread();
            in_thread = true;
            in_points = false;

            let bracket_start = t.rfind('[').unwrap();
            let bracket_end = t.rfind(']').unwrap_or(t.len());
            current.title = t[..bracket_start].trim().to_string();
            current.category = if bracket_start < bracket_end {
                t[bracket_start + 1..bracket_end].trim().to_string()
            } else {
                String::new()
            };
        }
    }

    if in_thread {
        flush(&current, &mut threads);
    }

    threads
}

fn parse_plot_thread_point(s: &str) -> (String, String, String) {
    // `📍設置: 第2章 - テキスト` or `📍設置: テキスト`
    let s = s.trim_start_matches("📍");
    if let Some(colon_pos) = s.find(':') {
        let point_type = s[..colon_pos].trim().to_string();
        let rest = s[colon_pos + 1..].trim();
        // `第N章 - content` を分解
        if rest.starts_with('第') {
            if let Some(dash_pos) = rest.find(" - ") {
                let chapter = rest[..dash_pos].trim().to_string();
                let content = rest[dash_pos + 3..].trim().to_string();
                return (point_type, chapter, content);
            }
        }
        (point_type, String::new(), rest.to_string())
    } else {
        (String::new(), String::new(), s.to_string())
    }
}

fn new_plot_thread() -> ParsedPlotThread {
    ParsedPlotThread {
        title: String::new(),
        category: String::new(),
        status: String::new(),
        importance: String::new(),
        description: String::new(),
        points: Vec::new(),
        related_characters: Vec::new(),
        resolution: String::new(),
        notes: String::new(),
        recommended_placement: String::new(),
        expected_effect: String::new(),
    }
}

/// プレーンテキストをTipTapのHTML段落に変換する
pub fn plain_to_html(text: &str) -> String {
    let mut html = String::new();
    let mut current_para = String::new();

    for line in text.lines() {
        if line.trim().is_empty() {
            if !current_para.trim().is_empty() {
                html.push_str("<p>");
                html.push_str(&escape_html(&current_para));
                html.push_str("</p>");
                current_para.clear();
            }
        } else {
            if !current_para.is_empty() {
                current_para.push('\n');
            }
            current_para.push_str(line);
        }
    }

    if !current_para.trim().is_empty() {
        html.push_str("<p>");
        html.push_str(&escape_html(&current_para));
        html.push_str("</p>");
    }

    if html.is_empty() {
        "<p></p>".to_string()
    } else {
        html
    }
}

fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn world_settings_no_duplicates() {
        let input: Vec<String> = [
            "古都A [geography]",
            "本文1。",
            "",
            "古都B [politics]",
            "本文2。",
            "",
            "古都C [culture]",
            "本文3。",
        ]
        .iter()
        .map(|s| s.to_string())
        .collect();
        let settings = parse_world_settings_txt(&input);
        assert_eq!(settings.len(), 3);
        assert_eq!(settings[0].title, "古都A");
        assert_eq!(settings[1].title, "古都B");
        assert_eq!(settings[2].title, "古都C");
        assert!(settings[0].content.contains("本文1"));
    }

    #[test]
    fn drafts_txt_splits_by_bracket_headers() {
        let input: Vec<String> = [
            "【第1章: 導入】",
            "本文1。",
            "【第2章: 展開】",
            "本文2。",
        ]
        .iter()
        .map(|s| s.to_string())
        .collect();
        let drafts = parse_drafts_txt(&input);
        assert_eq!(drafts.len(), 2);
        assert_eq!(drafts[0].chapter_ref.as_deref(), Some("第1章: 導入"));
        assert_eq!(drafts[1].chapter_ref.as_deref(), Some("第2章: 展開"));
    }

    #[test]
    fn txt_relation_intensity_clamped() {
        let (_, _, _, i) = parse_relation_header("A → B [friend] (強度: 5/10)");
        assert_eq!(i, 5);
        let (_, _, _, i) = parse_relation_header("A → B [friend] (強度: 99/10)");
        assert_eq!(i, 10);
    }
}

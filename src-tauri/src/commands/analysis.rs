use crate::models::{AnalysisResult, DialogueItem, ProofIssue, ProofRule};

type CmdResult<T> = Result<T, String>;

// =========================================
// ヘルパー関数
// =========================================

/// HTMLタグを除去してプレーンテキストを返す
/// ブロック要素の閉じタグ（</p>, </div>, <br>等）では改行を挿入する
fn strip_html(html: &str) -> String {
    let mut result = String::with_capacity(html.len());
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
                let tag_lower = tag_buf.to_lowercase();
                // ブロック要素の閉じタグまたは<br>で改行を挿入
                if tag_lower.starts_with("/p")
                    || tag_lower.starts_with("/div")
                    || tag_lower.starts_with("/li")
                    || tag_lower.starts_with("br")
                {
                    // 直前が改行でなければ改行を追加
                    if !result.ends_with('\n') {
                        result.push('\n');
                    }
                }
                tag_buf.clear();
            }
            _ if in_tag => {
                tag_buf.push(ch);
            }
            _ => {
                result.push(ch);
            }
        }
    }
    result
}

/// テキストを文単位に分割する（日本語の句点・感嘆符・疑問符で分割）
fn split_sentences(text: &str) -> Vec<String> {
    let mut sentences = Vec::new();
    let mut current = String::new();
    let terminators = ['。', '！', '？', '!', '?'];

    for ch in text.chars() {
        current.push(ch);
        if terminators.contains(&ch) {
            let trimmed = current.trim().to_string();
            if !trimmed.is_empty() {
                sentences.push(trimmed);
            }
            current.clear();
        }
    }
    // 句点なしで終わる最後の部分
    let trimmed = current.trim().to_string();
    if !trimmed.is_empty() {
        sentences.push(trimmed);
    }
    sentences
}

/// テキストを段落単位に分割する
fn split_paragraphs(text: &str) -> Vec<String> {
    text.split('\n')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

/// 「」内の文字数を数える
fn count_dialogue_chars(text: &str) -> usize {
    let mut count = 0;
    let mut in_dialogue = false;
    for ch in text.chars() {
        match ch {
            '「' | '『' => in_dialogue = true,
            '」' | '』' => in_dialogue = false,
            _ if in_dialogue => count += 1,
            _ => {}
        }
    }
    count
}

/// 文字種別の判定
fn is_hiragana(ch: char) -> bool {
    ('\u{3040}'..='\u{309F}').contains(&ch)
}

fn is_katakana(ch: char) -> bool {
    ('\u{30A0}'..='\u{30FF}').contains(&ch)
}

fn is_kanji(ch: char) -> bool {
    ('\u{4E00}'..='\u{9FFF}').contains(&ch)
        || ('\u{3400}'..='\u{4DBF}').contains(&ch)
        || ('\u{F900}'..='\u{FAFF}').contains(&ch)
}

// =========================================
// コマンド
// =========================================

/// 文章分析を実行する
#[tauri::command]
pub fn analyze_text(text: String) -> CmdResult<AnalysisResult> {
    let plain = strip_html(&text);
    let chars: Vec<char> = plain.chars().collect();
    let char_count = chars.len();

    // 空テキストの場合
    if char_count == 0 {
        return Ok(AnalysisResult {
            char_count: 0,
            line_count: 0,
            paragraph_count: 0,
            sentence_count: 0,
            hiragana_rate: 0.0,
            katakana_rate: 0.0,
            kanji_rate: 0.0,
            avg_sentence_length: 0.0,
            dialogue_rate: 0.0,
            sentence_lengths: vec![],
            dialogue_ratios: vec![],
        });
    }

    let line_count = plain.lines().count();
    let paragraphs = split_paragraphs(&plain);
    let paragraph_count = paragraphs.len();
    let sentences = split_sentences(&plain);
    let sentence_count = sentences.len();
    let sentence_lengths: Vec<usize> = sentences.iter().map(|s| s.chars().count()).collect();

    // 文字種カウント
    let total = char_count as f64;
    let hiragana_count = chars.iter().filter(|c| is_hiragana(**c)).count();
    let katakana_count = chars.iter().filter(|c| is_katakana(**c)).count();
    let kanji_count = chars.iter().filter(|c| is_kanji(**c)).count();

    // 台詞率
    let dialogue_chars = count_dialogue_chars(&plain);

    // 段落ごとの台詞比率
    let dialogue_ratios: Vec<f64> = paragraphs
        .iter()
        .map(|p| {
            let p_chars = p.chars().count();
            if p_chars == 0 {
                return 0.0;
            }
            count_dialogue_chars(p) as f64 / p_chars as f64
        })
        .collect();

    let avg_sentence_length = if sentence_count > 0 {
        sentence_lengths.iter().sum::<usize>() as f64 / sentence_count as f64
    } else {
        0.0
    };

    Ok(AnalysisResult {
        char_count,
        line_count,
        paragraph_count,
        sentence_count,
        hiragana_rate: hiragana_count as f64 / total,
        katakana_rate: katakana_count as f64 / total,
        kanji_rate: kanji_count as f64 / total,
        avg_sentence_length,
        dialogue_rate: dialogue_chars as f64 / total,
        sentence_lengths,
        dialogue_ratios,
    })
}

/// 台詞を抽出する
#[tauri::command]
pub fn extract_dialogues(text: String) -> CmdResult<Vec<DialogueItem>> {
    let plain = strip_html(&text);
    let paragraphs = split_paragraphs(&plain);
    let mut items = Vec::new();

    // 括弧ペアの定義: (開き, 閉じ, タイプ名)
    let bracket_pairs: &[(char, char, &str)] = &[
        ('「', '」', "normal"),
        ('『', '』', "double"),
        ('（', '）', "paren"),
    ];

    for (para_idx, para) in paragraphs.iter().enumerate() {
        let chars: Vec<char> = para.chars().collect();
        let mut i = 0;

        while i < chars.len() {
            let mut matched = false;

            // 各括弧ペアを検査
            for &(open, close, btype) in bracket_pairs {
                if chars[i] == open {
                    // 閉じ括弧を探す
                    let start = i;
                    let mut depth = 1;
                    let mut j = i + 1;
                    while j < chars.len() && depth > 0 {
                        if chars[j] == open {
                            depth += 1;
                        } else if chars[j] == close {
                            depth -= 1;
                        }
                        j += 1;
                    }
                    if depth == 0 {
                        let dialogue_text: String = chars[start..j].iter().collect();
                        items.push(DialogueItem {
                            text: dialogue_text,
                            paragraph_index: para_idx,
                            offset: start,
                            bracket_type: btype.to_string(),
                        });
                        i = j;
                        matched = true;
                        break;
                    }
                }
            }

            if !matched {
                i += 1;
            }
        }
    }

    Ok(items)
}

/// 校正ルールの定義
fn get_proof_rules() -> Vec<ProofRule> {
    vec![
        // 二重表現
        ProofRule {
            category: "二重表現",
            pattern: "頭痛が痛い",
            suggestion: "頭痛がする / 頭が痛い",
            message: "「頭痛」と「痛い」で意味が重複しています",
            severity: "warning",
        },
        ProofRule {
            category: "二重表現",
            pattern: "馬から落馬",
            suggestion: "落馬した / 馬から落ちた",
            message: "「馬」と「落馬」で意味が重複しています",
            severity: "warning",
        },
        ProofRule {
            category: "二重表現",
            pattern: "後で後悔",
            suggestion: "後悔する",
            message: "「後で」と「後悔」で意味が重複しています",
            severity: "warning",
        },
        ProofRule {
            category: "二重表現",
            pattern: "まず最初に",
            suggestion: "まず / 最初に",
            message: "「まず」と「最初に」で意味が重複しています",
            severity: "info",
        },
        ProofRule {
            category: "二重表現",
            pattern: "一番最初",
            suggestion: "最初 / 一番初め",
            message: "「一番」と「最初」で意味が重複しています",
            severity: "info",
        },
        ProofRule {
            category: "二重表現",
            pattern: "返事を返す",
            suggestion: "返事をする / 返す",
            message: "「返事」と「返す」で意味が重複しています",
            severity: "warning",
        },
        ProofRule {
            category: "二重表現",
            pattern: "犯罪を犯す",
            suggestion: "罪を犯す / 犯罪をする",
            message: "「犯罪」と「犯す」で意味が重複しています",
            severity: "warning",
        },
        ProofRule {
            category: "二重表現",
            pattern: "違和感を感じる",
            suggestion: "違和感を覚える / 違和感がある",
            message: "「違和感」と「感じる」で意味が重複しています",
            severity: "info",
        },
        ProofRule {
            category: "二重表現",
            pattern: "被害を被る",
            suggestion: "被害を受ける / 被る",
            message: "「被害」と「被る」で意味が重複しています",
            severity: "warning",
        },
        ProofRule {
            category: "二重表現",
            pattern: "日本に来日",
            suggestion: "来日した / 日本に来た",
            message: "「日本に」と「来日」で意味が重複しています",
            severity: "warning",
        },
        // 誤用
        ProofRule {
            category: "誤用",
            pattern: "的を得る",
            suggestion: "的を射る",
            message: "「的を得る」は「的を射る」の誤用です",
            severity: "error",
        },
        ProofRule {
            category: "誤用",
            pattern: "汚名挽回",
            suggestion: "汚名返上 / 名誉挽回",
            message: "「汚名挽回」は「汚名返上」または「名誉挽回」の混同です",
            severity: "error",
        },
        ProofRule {
            category: "誤用",
            pattern: "熱にうなされる",
            suggestion: "熱に浮かされる",
            message: "「うなされる」は悪夢に対して使います。熱の場合は「浮かされる」",
            severity: "error",
        },
        ProofRule {
            category: "誤用",
            pattern: "足元をすくわれる",
            suggestion: "足をすくわれる",
            message: "「足元をすくわれる」は「足をすくわれる」の誤用です",
            severity: "warning",
        },
        ProofRule {
            category: "誤用",
            pattern: "采配を振る",
            suggestion: "采配を振るう",
            message: "「采配を振る」は「采配を振るう」の誤用です",
            severity: "warning",
        },
        ProofRule {
            category: "誤用",
            pattern: "敷居が高い",
            suggestion: "ハードルが高い（難易度の意味の場合）",
            message: "「敷居が高い」は本来「不義理で行きづらい」という意味です",
            severity: "info",
        },
        // 冗長表現
        ProofRule {
            category: "冗長表現",
            pattern: "することができる",
            suggestion: "できる / する",
            message: "「することができる」は冗長です",
            severity: "info",
        },
        ProofRule {
            category: "冗長表現",
            pattern: "することが可能",
            suggestion: "できる",
            message: "「することが可能」は冗長です",
            severity: "info",
        },
        ProofRule {
            category: "冗長表現",
            pattern: "という事実",
            suggestion: "ということ / （省略可能か検討）",
            message: "「という事実」は冗長になりがちです",
            severity: "info",
        },
        // 記号の不整合
        ProofRule {
            category: "記号",
            pattern: "...",
            suggestion: "……（三点リーダー×2）",
            message: "小説では「...」ではなく「……」を使うのが慣例です",
            severity: "warning",
        },
        ProofRule {
            category: "記号",
            pattern: "---",
            suggestion: "――（ダッシュ×2）",
            message: "小説では「---」ではなく「――」を使うのが慣例です",
            severity: "warning",
        },
        ProofRule {
            category: "記号",
            pattern: "!?",
            suggestion: "！？",
            message: "半角の感嘆符・疑問符は全角に統一しましょう",
            severity: "info",
        },
    ]
}

/// 校正を実行する
#[tauri::command]
pub fn run_proofread(text: String, categories: Vec<String>) -> CmdResult<Vec<ProofIssue>> {
    let plain = strip_html(&text);
    let rules = get_proof_rules();
    let mut issues = Vec::new();

    for rule in &rules {
        // カテゴリフィルタ: 空の場合は全カテゴリ対象
        if !categories.is_empty() && !categories.iter().any(|c| c == rule.category) {
            continue;
        }

        // パターンマッチ（全出現箇所を検出）
        let pattern_chars: Vec<char> = rule.pattern.chars().collect();
        let pattern_len = pattern_chars.len();
        let plain_chars: Vec<char> = plain.chars().collect();

        let mut search_start = 0;
        while search_start + pattern_len <= plain_chars.len() {
            let slice: String = plain_chars[search_start..search_start + pattern_len]
                .iter()
                .collect();
            if slice == rule.pattern {
                issues.push(ProofIssue {
                    category: rule.category.to_string(),
                    message: rule.message.to_string(),
                    suggestion: Some(rule.suggestion.to_string()),
                    offset: search_start,
                    length: pattern_len,
                    severity: rule.severity.to_string(),
                });
                search_start += pattern_len;
            } else {
                search_start += 1;
            }
        }
    }

    // オフセット順にソート
    issues.sort_by_key(|i| i.offset);

    Ok(issues)
}

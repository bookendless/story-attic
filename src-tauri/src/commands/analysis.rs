use crate::models::{
    AnalysisResult, DialogueItem, KanjiFrequency, ProofIssue, ProofRule, StructureSection,
    WordFrequency,
};
use std::collections::HashMap;

type CmdResult<T> = Result<T, String>;

// =========================================
// ヘルパー関数（基本）
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

/// 感嘆符・疑問符の数
fn count_exclamations(text: &str) -> usize {
    text.chars().filter(|c| matches!(c, '！' | '？' | '!' | '?')).count()
}

// =========================================
// 語彙分析: tokenize()抽象化層
// =========================================

/// トークン化（簡易方式）
///
/// 将来 lindera クレート導入時は本関数の中身のみを差し替え可能な設計。
///
/// 現在の実装:
/// 1. 句読点・助詞・括弧・記号でチャンクに分割
/// 2. 各チャンクから 2〜3 文字の n-gram を生成
/// 3. 純粋な助詞列の n-gram を除外
fn tokenize(text: &str) -> Vec<String> {
    // セパレータ: 句読点・括弧・空白・記号
    let is_separator = |c: char| {
        matches!(
            c,
            '。' | '、'
                | '！'
                | '？'
                | '「'
                | '」'
                | '『'
                | '』'
                | '（'
                | '）'
                | '【'
                | '】'
                | '〈'
                | '〉'
                | '《'
                | '》'
                | '　'
                | ' '
                | '\n'
                | '\t'
                | '\r'
                | '・'
                | '…'
                | '‥'
                | '，'
                | '．'
                | '!'
                | '?'
                | '.'
                | ','
                | '"'
                | '\''
                | ':'
                | '：'
                | ';'
                | '；'
                | 'ー'
                | '―'
                | '〜'
                | '～'
                | '／'
                | '\\'
        ) || c.is_ascii_digit()
            || ('０'..='９').contains(&c)
    };

    // 段階1: チャンクへ分割
    let mut chunks: Vec<Vec<char>> = Vec::new();
    let mut current: Vec<char> = Vec::new();
    for ch in text.chars() {
        if is_separator(ch) {
            if !current.is_empty() {
                chunks.push(std::mem::take(&mut current));
            }
        } else {
            current.push(ch);
        }
    }
    if !current.is_empty() {
        chunks.push(current);
    }

    // 段階2: 各チャンクから 2〜3 文字 n-gram を生成
    let mut tokens = Vec::new();
    for chunk in &chunks {
        for len in [2usize, 3] {
            if chunk.len() >= len {
                for i in 0..=chunk.len() - len {
                    let ngram: String = chunk[i..i + len].iter().collect();
                    // ひらがなのみで構成され、かつ助詞として頻出するn-gramは除外
                    if is_particle_only(&ngram) {
                        continue;
                    }
                    tokens.push(ngram);
                }
            }
        }
    }
    tokens
}

/// 助詞のみで構成される短いn-gramかどうかの判定
fn is_particle_only(s: &str) -> bool {
    // 頻出助詞・助動詞の短いn-gram（ひらがなのみ）
    const PARTICLES: &[&str] = &[
        "は", "が", "を", "に", "の", "で", "と", "へ", "も", "や", "よ", "ね", "な",
        "です", "ます", "から", "まで", "より", "への", "では", "には", "とは", "とも",
        "でも", "しか", "だけ", "ので", "のに", "けれど", "けど", "かも", "こそ", "さえ",
        "って", "なら", "した", "する", "して", "しな", "され", "せる", "られ", "いる",
        "いた", "ある", "あっ", "ない", "なく", "なり", "たち", "よう", "その", "この",
        "あの", "どの", "それ", "これ", "あれ", "どれ", "そう", "こう", "ああ", "どう",
        "ため", "ほど", "こと", "もの", "とき", "さん", "くん", "ちゃん",
    ];

    let chars: Vec<char> = s.chars().collect();
    // 全てひらがなかチェック
    if !chars.iter().all(|c| is_hiragana(*c)) {
        return false;
    }
    PARTICLES.contains(&s)
}

// =========================================
// 語彙分析
// =========================================

/// 語彙頻度の計算（上位30件）とTTR
fn compute_vocabulary(
    text: &str,
) -> (Vec<WordFrequency>, f64, usize, usize) {
    let tokens = tokenize(text);
    let total = tokens.len();

    if total == 0 {
        return (Vec::new(), 0.0, 0, 0);
    }

    let mut counts: HashMap<String, usize> = HashMap::new();
    for t in &tokens {
        *counts.entry(t.clone()).or_insert(0) += 1;
    }

    let unique = counts.len();
    let ttr = unique as f64 / total as f64;

    // 頻度2以上のみを対象に、上位30件を返す
    let mut freq_vec: Vec<(String, usize)> =
        counts.into_iter().filter(|(_, c)| *c >= 2).collect();
    freq_vec.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
    freq_vec.truncate(30);

    let word_frequencies: Vec<WordFrequency> = freq_vec
        .into_iter()
        .map(|(word, count)| WordFrequency { word, count })
        .collect();

    (word_frequencies, ttr, unique, total)
}

// =========================================
// テンポ分析
// =========================================

/// 文長の分散・標準偏差を計算
fn compute_rhythm_variance(sentence_lengths: &[usize]) -> (f64, f64) {
    if sentence_lengths.is_empty() {
        return (0.0, 0.0);
    }
    let n = sentence_lengths.len() as f64;
    let sum: f64 = sentence_lengths.iter().map(|&l| l as f64).sum();
    let mean = sum / n;
    let variance: f64 = sentence_lengths
        .iter()
        .map(|&l| {
            let diff = l as f64 - mean;
            diff * diff
        })
        .sum::<f64>()
        / n;
    let stddev = variance.sqrt();
    (variance, stddev)
}

/// 段落ごとに「台詞主体か」を判定（台詞率 >= 0.5）
fn compute_dialogue_pattern(paragraphs: &[String]) -> Vec<bool> {
    paragraphs
        .iter()
        .map(|p| {
            let total = p.chars().count();
            if total == 0 {
                return false;
            }
            let d = count_dialogue_chars(p);
            (d as f64 / total as f64) >= 0.5
        })
        .collect()
}

/// 場面転換の検出（空行・セパレータ記号のみの段落）
/// 段落分割時に空行は既に除かれるため、ここでは「セパレータ記号のみ」の段落を数える
fn count_scene_breaks(plain: &str) -> usize {
    let mut count = 0;
    let mut prev_empty = false;
    for line in plain.split('\n') {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            // 連続空行は1回の場面転換として数える
            if !prev_empty {
                count += 1;
            }
            prev_empty = true;
        } else {
            prev_empty = false;
            // セパレータ記号のみで構成される行
            if is_scene_separator_line(trimmed) {
                count += 1;
            }
        }
    }
    count
}

fn is_scene_separator_line(line: &str) -> bool {
    let separators: &[char] = &['◇', '◆', '★', '☆', '*', '＊', '─', '━', '＿', '＝', '・', ' ', '　'];
    !line.is_empty() && line.chars().all(|c| separators.contains(&c))
}

// =========================================
// 構造分析
// =========================================

/// 起承転結の推定（文字数基準で4等分）
fn estimate_structure(plain: &str) -> Vec<StructureSection> {
    let labels = ["起", "承", "転", "結"];
    let chars: Vec<char> = plain.chars().collect();
    let total = chars.len();

    if total == 0 {
        return labels
            .iter()
            .map(|l| StructureSection {
                label: l.to_string(),
                char_ratio: 0.0,
                dialogue_rate: 0.0,
                avg_sentence_length: 0.0,
            })
            .collect();
    }

    let seg_size = total / 4;
    let mut sections = Vec::new();

    for (i, label) in labels.iter().enumerate() {
        let start = i * seg_size;
        let end = if i == 3 { total } else { (i + 1) * seg_size };
        let segment: String = chars[start..end].iter().collect();

        let seg_total = segment.chars().count();
        let seg_dialogue = count_dialogue_chars(&segment);
        let sentences = split_sentences(&segment);
        let avg_len = if sentences.is_empty() {
            0.0
        } else {
            sentences.iter().map(|s| s.chars().count()).sum::<usize>() as f64
                / sentences.len() as f64
        };

        sections.push(StructureSection {
            label: label.to_string(),
            char_ratio: seg_total as f64 / total as f64,
            dialogue_rate: if seg_total > 0 {
                seg_dialogue as f64 / seg_total as f64
            } else {
                0.0
            },
            avg_sentence_length: avg_len,
        });
    }

    sections
}

/// クライマックス推定と盛り上がり曲線の計算
///
/// 10区間に分割し、各区間で「盛り上がり度スコア」を計算:
/// スコア = 台詞率 × 0.4 + 感嘆符密度 × 0.4 + 文長変動 × 0.2
fn estimate_climax(plain: &str) -> (f64, Vec<f64>) {
    let chars: Vec<char> = plain.chars().collect();
    let total = chars.len();

    if total == 0 {
        return (0.0, vec![0.0; 10]);
    }

    const SEGMENTS: usize = 10;
    let seg_size = (total / SEGMENTS).max(1);
    let mut scores = Vec::with_capacity(SEGMENTS);

    for i in 0..SEGMENTS {
        let start = i * seg_size;
        let end = if i == SEGMENTS - 1 {
            total
        } else {
            ((i + 1) * seg_size).min(total)
        };
        if start >= total {
            scores.push(0.0);
            continue;
        }
        let segment: String = chars[start..end].iter().collect();
        let seg_chars = segment.chars().count().max(1);

        let dialogue = count_dialogue_chars(&segment) as f64 / seg_chars as f64;
        let excl = count_exclamations(&segment) as f64 / seg_chars as f64 * 100.0; // スケール調整
        let sentences = split_sentences(&segment);
        let lens: Vec<usize> = sentences.iter().map(|s| s.chars().count()).collect();
        let (_var, stddev) = compute_rhythm_variance(&lens);
        // 文長ばらつき（0〜1 に正規化）
        let rhythm_score = (stddev / 30.0).min(1.0);

        let score = dialogue * 0.4 + excl.min(1.0) * 0.4 + rhythm_score * 0.2;
        scores.push(score);
    }

    // クライマックス位置 = スコアが最大の区間の中央
    let (max_idx, _) = scores
        .iter()
        .enumerate()
        .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
        .unwrap_or((0, &0.0));
    let climax_position = (max_idx as f64 + 0.5) / SEGMENTS as f64;

    (climax_position, scores)
}

// =========================================
// 文体分析（敬体/常体）
// =========================================

#[derive(Debug, Clone, Copy, PartialEq)]
enum SentenceStyle {
    Polite,  // 敬体
    Plain,   // 常体
    Unknown, // 判定不能
}

/// 文の文体を判定
fn classify_sentence_style(sentence: &str) -> SentenceStyle {
    // 末尾の句読点・記号を除去
    let trimmed: String = sentence
        .chars()
        .filter(|c| !matches!(c, '。' | '！' | '？' | '!' | '?' | '」' | '』' | '）'))
        .collect();
    let trimmed = trimmed.trim();

    // 敬体パターン（優先判定）
    let polite_endings = [
        "です", "ます", "ました", "でした", "ません", "でしょう", "ましょう", "でしょ",
        "ですね", "ますね", "ですよ", "ますよ", "ですか", "ますか",
    ];
    for ending in &polite_endings {
        if trimmed.ends_with(ending) {
            return SentenceStyle::Polite;
        }
    }

    // 常体パターン
    let plain_endings = [
        "だ", "である", "だった", "であった", "だろう", "であろう", "いる", "いた",
        "ない", "なかった", "た", "る", "う", "よう", "い", "ぬ",
    ];
    for ending in &plain_endings {
        if trimmed.ends_with(ending) {
            return SentenceStyle::Plain;
        }
    }

    SentenceStyle::Unknown
}

/// 文体分析の結果を返す
fn analyze_style(sentences: &[String]) -> (usize, usize, Vec<usize>) {
    let styles: Vec<SentenceStyle> =
        sentences.iter().map(|s| classify_sentence_style(s)).collect();

    let polite_count = styles.iter().filter(|s| **s == SentenceStyle::Polite).count();
    let plain_count = styles.iter().filter(|s| **s == SentenceStyle::Plain).count();

    // 混在警告: ウィンドウサイズ5で、敬体と常体が同時に出現する中心文のindexを記録
    let mut warnings = Vec::new();
    let window = 5usize;
    if styles.len() >= window {
        for i in 0..=styles.len() - window {
            let slice = &styles[i..i + window];
            let has_polite = slice.contains(&SentenceStyle::Polite);
            let has_plain = slice.contains(&SentenceStyle::Plain);
            if has_polite && has_plain {
                warnings.push(i + window / 2);
            }
        }
    }
    // 重複を除去
    warnings.sort_unstable();
    warnings.dedup();

    (polite_count, plain_count, warnings)
}

// =========================================
// 読みやすさ（難読漢字・読了時間）
// =========================================

/// 文学作品に頻出する「難読漢字」のセット
///
/// 常用漢字外 + 読みが難しい漢字を中心に収録。
/// 将来的には JIS 第2水準判定や外部辞書に置き換え可能。
const DIFFICULT_KANJI_LIST: &str = "\
薔薇鬱憂躇躊曖昧刹那徘徊囁覗朧煌灼蜻蛉茫蒼穹漣瀟洒咄嗟\
顰蹙恍惚贖葛藤懺悔饒舌逍遙憔悴闊呂律蝋燭萌眩暈軋滲迸\
嗚咽綻呟呻嘲戦慄轟畏怖茹凋瀰漫忿怯懦躁羞恥姦淫靡啼諂\
諧謔舐睨瞼睫眉黛頬顎顳顬頤臍鳩尾脛踵膕腓蹠趾爪蘊蓄\
贅沢奢侈驕驍驪驤驥鑑鎧兜甲冑鎖刃鎚鏃矢箙弭弓靭\
苛烈苛酷熾烈熾熱燗燻燦爛爛漫艶麗艶美艶然黎明薄暮昏迷\
黄昏朦朧靄霧靄煙霞霞烟煙燻燻煤煤塵埃塵芥塵堆\
皓皓皎皎潸潸悄悄戚戚惨惨慘慘怏怏怕怕懼懼惘惘惶惶惴惴\
怛怛忸忸惹惹慊慊愀愀愜愜愎愎慍慍慳慳慷慷恬恬悸悸\
咲綻頷斡旋拗捻捏捩捌掠掠擽擽攪拌攫攫拭拭拘泥拘泥\
遥遙嘯嘯嗜嗜噎噎哽哽嘔嘔噫噫歔歔欷欷嚔嚔咳咳嗽嗽\
疼疼疼痛痙攣癲癇癆癆癰癰癤癤癬癬瘡瘡痂痂疵瑕瑕疵\
朔旦朔朔朔旦朔朔晦晦朔朔";

/// 推定読了時間（分）を計算: 小説の平均読書速度 500文字/分
fn estimate_reading_minutes(char_count: usize) -> f64 {
    char_count as f64 / 500.0
}

/// 難読漢字の検出
fn detect_difficult_kanji(plain: &str) -> (Vec<KanjiFrequency>, usize) {
    let difficult_set: std::collections::HashSet<char> =
        DIFFICULT_KANJI_LIST.chars().collect();

    let mut counts: HashMap<char, usize> = HashMap::new();
    let mut unique_kanji = std::collections::HashSet::new();

    for ch in plain.chars() {
        if is_kanji(ch) {
            unique_kanji.insert(ch);
            // 難読セット内 または CJK Extension A (U+3400-4DBF) は常に難読
            let is_difficult = difficult_set.contains(&ch)
                || ('\u{3400}'..='\u{4DBF}').contains(&ch);
            if is_difficult {
                *counts.entry(ch).or_insert(0) += 1;
            }
        }
    }

    let mut freq_vec: Vec<(char, usize)> = counts.into_iter().collect();
    freq_vec.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
    freq_vec.truncate(30);

    let difficult_kanji: Vec<KanjiFrequency> = freq_vec
        .into_iter()
        .map(|(ch, count)| KanjiFrequency {
            kanji: ch.to_string(),
            count,
        })
        .collect();

    (difficult_kanji, unique_kanji.len())
}

// =========================================
// 拡張分析ヘルパー関数
// =========================================

/// 動詞語尾パターンで動詞数を概算カウント（形態素解析なし）
fn count_verb_patterns(text: &str) -> usize {
    const VERB_ENDINGS: &[&str] = &[
        "する", "した", "して", "しない", "しれ", "れる", "られる", "せる", "させる",
        "なる", "なった", "なって", "なり", "ける", "けた", "いる", "いた", "いて",
        "った", "って", "ある", "あった", "あって", "おく", "みる", "くる", "くれ",
        "もらう", "やる", "もつ", "ぬ", "んだ", "べき",
    ];
    let chunks: Vec<&str> = text.split(['。', '、', '！', '？', '!', '?']).collect();
    chunks.iter().filter(|c| {
        let c = c.trim();
        c.chars().count() >= 2 && VERB_ENDINGS.iter().any(|e| c.ends_with(e))
    }).count()
}

/// い形容詞語尾パターンで形容詞数を概算カウント
fn count_adj_patterns(text: &str) -> usize {
    const I_ADJ_ENDINGS: &[&str] = &[
        "しい", "しかった", "しくない", "しくて",
        "ない", "なかった", "なくて",
        "かった", "くない", "くて",
    ];
    let chunks: Vec<&str> = text.split(['。', '、', '！', '？', '!', '?']).collect();
    chunks.iter().filter(|c| {
        let c = c.trim();
        c.chars().count() >= 2 && I_ADJ_ENDINGS.iter().any(|e| c.ends_with(e))
    }).count()
}

/// 心理語辞書でカウント
fn count_psycho_words(text: &str) -> usize {
    const PSYCHO_WORDS: &[&str] = &[
        "思う", "思った", "思い", "感じる", "感じた", "感じ",
        "気づく", "気づいた", "気づき", "考える", "考えた", "考え",
        "悩む", "悩んだ", "信じる", "信じた", "望む", "望んだ",
        "恐れる", "恐れた", "喜ぶ", "喜んだ", "悲しむ", "悲しんだ",
        "怒る", "怒った", "驚く", "驚いた", "疑う", "疑った",
        "期待する", "心配する", "不安に", "緊張する", "安心する",
        "後悔する", "後悔した", "願う", "願った",
    ];
    PSYCHO_WORDS.iter().map(|w| text.matches(w).count()).sum()
}

/// 比喩表現パターンでカウント
fn count_metaphors(text: &str) -> usize {
    const METAPHOR_PATTERNS: &[&str] = &[
        "ような", "ように", "みたいな", "みたいに",
        "まるで", "ごとく", "ごとき", "さながら",
        "かのよう", "かの如",
    ];
    METAPHOR_PATTERNS.iter().map(|p| text.matches(p).count()).sum()
}

/// 2文字以上連続するカタカナ語をカウント
fn count_katakana_words(text: &str) -> usize {
    let chars: Vec<char> = text.chars().collect();
    let mut count = 0;
    let mut i = 0;
    while i < chars.len() {
        if is_katakana(chars[i]) {
            let mut j = i + 1;
            while j < chars.len() && is_katakana(chars[j]) {
                j += 1;
            }
            if j - i >= 2 {
                count += 1;
            }
            i = j;
        } else {
            i += 1;
        }
    }
    count
}

/// 一人称語の出現数をカウント
fn count_first_person(text: &str) -> usize {
    const FIRST_PERSON_WORDS: &[&str] = &[
        "私", "わたし", "わたくし", "僕", "ぼく", "俺", "おれ",
        "あたし", "あたい", "うち", "自分",
    ];
    FIRST_PERSON_WORDS.iter().map(|w| text.matches(w).count()).sum()
}

/// 一人称⇔三人称の視点切替数を検出
fn count_pov_switches(sentences: &[String]) -> usize {
    const FIRST_PERSON: &[&str] = &[
        "私", "わたし", "わたくし", "僕", "ぼく", "俺", "おれ", "あたし",
    ];
    const THIRD_PERSON: &[&str] = &["彼", "彼女", "彼ら", "彼女ら"];

    let classify = |s: &str| -> i8 {
        let has_first = FIRST_PERSON.iter().any(|w| s.contains(w));
        let has_third = THIRD_PERSON.iter().any(|w| s.contains(w));
        if has_first && !has_third { 1 }
        else if has_third && !has_first { -1 }
        else { 0 }
    };

    let mut switches = 0;
    let mut last_pov: i8 = 0;
    for s in sentences {
        let pov = classify(s);
        if pov != 0 && last_pov != 0 && pov != last_pov {
            switches += 1;
        }
        if pov != 0 {
            last_pov = pov;
        }
    }
    switches
}

/// 疑問文（？で終わる文）の数をカウント
fn count_question_sentences(sentences: &[String]) -> usize {
    sentences.iter().filter(|s| s.ends_with('？') || s.ends_with('?')).count()
}

/// 難語率: 難読漢字を含む文の比率
fn compute_difficult_word_rate(sentences: &[String]) -> f64 {
    if sentences.is_empty() {
        return 0.0;
    }
    let difficult_set: std::collections::HashSet<char> =
        DIFFICULT_KANJI_LIST.chars().collect();
    let count = sentences.iter().filter(|s| {
        s.chars().any(|c| {
            difficult_set.contains(&c) || ('\u{3400}'..='\u{4DBF}').contains(&c)
        })
    }).count();
    count as f64 / sentences.len() as f64
}

/// 感情分析: ポジ/ネガ/緊張語数と感情曲線（10ブロック）
fn compute_emotion(plain: &str, char_count: usize) -> (usize, usize, usize, Vec<f64>) {
    const POSITIVE_WORDS: &[&str] = &[
        "嬉しい", "嬉しかった", "楽しい", "楽しかった", "幸せ", "幸福",
        "喜び", "希望", "夢", "笑", "愛", "好き", "大好き",
        "安心", "穏やか", "明るい", "輝く", "温かい", "優しい",
        "感謝", "素晴らしい", "美しい", "綺麗", "可愛い",
    ];
    const NEGATIVE_WORDS: &[&str] = &[
        "悲しい", "悲しかった", "辛い", "苦しい", "怖い", "恐ろしい",
        "絶望", "孤独", "寂しい", "憎い", "怒り", "悔しい",
        "不安", "焦り", "混乱", "後悔", "失望", "暗い",
        "冷たい", "痛い", "涙", "泣く", "泣いた",
    ];
    const TENSION_WORDS: &[&str] = &[
        "危険", "危機", "絶体絶命", "追い詰め", "逃げる", "逃げた",
        "戦う", "戦った", "攻撃", "叫ぶ", "叫んだ", "震える", "震えた",
        "血", "死", "殺", "倒れ", "崩れ", "爆発", "衝撃",
        "緊急", "緊張", "迫る", "迫った",
    ];

    let positive = POSITIVE_WORDS.iter().map(|w| plain.matches(w).count()).sum::<usize>();
    let negative = NEGATIVE_WORDS.iter().map(|w| plain.matches(w).count()).sum::<usize>();
    let tension  = TENSION_WORDS.iter().map(|w| plain.matches(w).count()).sum::<usize>();

    // 感情曲線: 10ブロックに分割
    let chars: Vec<char> = plain.chars().collect();
    let total = char_count.max(1);
    let seg = (total / 10).max(1);
    let mut curve = Vec::with_capacity(10);

    for i in 0..10 {
        let start = i * seg;
        let end = if i == 9 { total } else { ((i + 1) * seg).min(total) };
        if start >= total {
            curve.push(0.0);
            continue;
        }
        let seg_text: String = chars[start..end.min(chars.len())].iter().collect();
        let pos = POSITIVE_WORDS.iter().map(|w| seg_text.matches(w).count()).sum::<usize>() as f64;
        let neg = NEGATIVE_WORDS.iter().map(|w| seg_text.matches(w).count()).sum::<usize>() as f64;
        let total_e = pos + neg;
        let score = if total_e > 0.0 { (pos - neg) / total_e } else { 0.0 };
        curve.push(score);
    }

    (positive, negative, tension, curve)
}

/// 語り手タイプと分析テキストを生成
fn compute_narrator(
    first_person_count: usize,
    pov_switch_count: usize,
    char_count: usize,
) -> (String, String) {
    let fp_rate = first_person_count as f64 / (char_count as f64 / 1000.0).max(0.001);

    let narrator_type = if pov_switch_count >= 3 {
        "混在"
    } else if fp_rate > 2.0 {
        "一人称"
    } else if fp_rate < 0.5 {
        "三人称"
    } else {
        "不明"
    };

    let analysis = match narrator_type {
        "一人称" => format!(
            "一人称視点が中心です（一人称語：{:.1}回/千字）。\
            読者との距離が近く、主人公の内面描写に適しています。",
            fp_rate
        ),
        "三人称" => format!(
            "三人称視点が中心です（一人称語：{:.1}回/千字）。\
            客観的な描写と複数キャラクターの描写に適しています。",
            fp_rate
        ),
        "混在" => format!(
            "視点の切り替えが{}回検出されました（一人称語：{:.1}回/千字）。\
            意図的でない混在は読者を混乱させる可能性があります。",
            pov_switch_count, fp_rate
        ),
        _ => format!(
            "視点の特定が困難です（一人称語：{:.1}回/千字、\
            視点切替：{}回）。",
            fp_rate, pov_switch_count
        ),
    };

    (narrator_type.to_string(), analysis)
}

/// 読解指数を計算（0〜100、高いほど難解）
fn compute_readability_score(
    avg_sentence_length: f64,
    kanji_rate: f64,
    difficult_word_rate: f64,
) -> f64 {
    // 平均文長：20字超で難解度が上昇
    let len_score = ((avg_sentence_length - 10.0) / 50.0).clamp(0.0, 1.0) * 40.0;
    // 漢字率：30%超で難解度が上昇
    let kanji_score = ((kanji_rate - 0.2) / 0.4).clamp(0.0, 1.0) * 40.0;
    // 難語率：直接スコアに寄与
    let diff_score = difficult_word_rate.clamp(0.0, 1.0) * 20.0;

    (len_score + kanji_score + diff_score).clamp(0.0, 100.0)
}

/// 文章リズムを計算（句点間の平均文字数）
fn compute_writing_rhythm(plain: &str) -> f64 {
    let segments: Vec<&str> = plain.split('。').collect();
    let non_empty: Vec<usize> = segments
        .iter()
        .map(|s| s.chars().count())
        .filter(|&c| c > 0)
        .collect();
    if non_empty.is_empty() {
        return 0.0;
    }
    non_empty.iter().sum::<usize>() as f64 / non_empty.len() as f64
}

// =========================================
// 空の結果を返すヘルパー
// =========================================

fn empty_result() -> AnalysisResult {
    AnalysisResult {
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
        word_frequencies: vec![],
        vocabulary_diversity: 0.0,
        unique_token_count: 0,
        total_token_count: 0,
        rhythm_variance: 0.0,
        rhythm_stddev: 0.0,
        dialogue_narrative_pattern: vec![],
        scene_break_count: 0,
        scene_break_density: 0.0,
        estimated_structure: vec![],
        climax_position: 0.0,
        intensity_curve: vec![0.0; 10],
        polite_form_count: 0,
        plain_form_count: 0,
        polite_form_ratio: 0.0,
        mixed_style_warnings: vec![],
        estimated_reading_minutes: 0.0,
        difficult_kanji: vec![],
        unique_kanji_count: 0,
        avg_paragraph_length: 0.0,
        max_sentence_length: 0,
        paragraph_lengths: vec![],
        verb_density: 0.0,
        adj_density: 0.0,
        psycho_density: 0.0,
        difficult_word_rate: 0.0,
        metaphor_rate: 0.0,
        katakana_word_count: 0,
        verb_count: 0,
        adj_count: 0,
        psycho_word_count: 0,
        metaphor_count: 0,
        first_person_count: 0,
        pov_switch_count: 0,
        question_sentence_count: 0,
        narrator_type: String::new(),
        narrator_analysis: String::new(),
        positive_word_count: 0,
        negative_word_count: 0,
        tension_word_count: 0,
        emotion_curve: vec![0.0; 10],
        readability_score: 0.0,
        writing_rhythm: 0.0,
    }
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
        return Ok(empty_result());
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

    // --- 語彙分析 ---
    let (word_frequencies, vocabulary_diversity, unique_token_count, total_token_count) =
        compute_vocabulary(&plain);

    // --- テンポ分析 ---
    let (rhythm_variance, rhythm_stddev) = compute_rhythm_variance(&sentence_lengths);
    let dialogue_narrative_pattern = compute_dialogue_pattern(&paragraphs);
    let scene_break_count = count_scene_breaks(&plain);
    let scene_break_density = if paragraph_count > 0 {
        scene_break_count as f64 / paragraph_count as f64
    } else {
        0.0
    };

    // --- 構造分析 ---
    let estimated_structure = estimate_structure(&plain);
    let (climax_position, intensity_curve) = estimate_climax(&plain);

    // --- 文体分析 ---
    let (polite_form_count, plain_form_count, mixed_style_warnings) = analyze_style(&sentences);
    let style_total = polite_form_count + plain_form_count;
    let polite_form_ratio = if style_total > 0 {
        polite_form_count as f64 / style_total as f64
    } else {
        0.0
    };

    // --- 読みやすさ ---
    let estimated_reading_minutes = estimate_reading_minutes(char_count);
    let (difficult_kanji, unique_kanji_count) = detect_difficult_kanji(&plain);

    // --- 構造拡張 ---
    let paragraph_lengths: Vec<usize> = paragraphs.iter().map(|p| p.chars().count()).collect();
    let avg_paragraph_length = if paragraph_count > 0 {
        paragraph_lengths.iter().sum::<usize>() as f64 / paragraph_count as f64
    } else {
        0.0
    };
    let max_sentence_length = sentence_lengths.iter().copied().max().unwrap_or(0);

    // --- テンポ・語彙拡張 ---
    let verb_count = count_verb_patterns(&plain);
    let adj_count = count_adj_patterns(&plain);
    let psycho_word_count = count_psycho_words(&plain);
    let metaphor_count = count_metaphors(&plain);
    let katakana_word_count = count_katakana_words(&plain);
    let verb_density = if sentence_count > 0 { verb_count as f64 / sentence_count as f64 } else { 0.0 };
    let adj_density = if sentence_count > 0 { adj_count as f64 / sentence_count as f64 } else { 0.0 };
    let psycho_density = if sentence_count > 0 { psycho_word_count as f64 / sentence_count as f64 } else { 0.0 };
    let difficult_word_rate = compute_difficult_word_rate(&sentences);
    let metaphor_rate = if sentence_count > 0 { metaphor_count as f64 / sentence_count as f64 } else { 0.0 };

    // --- 人物＆視点 ---
    let first_person_count = count_first_person(&plain);
    let pov_switch_count = count_pov_switches(&sentences);
    let question_sentence_count = count_question_sentences(&sentences);
    let (narrator_type, narrator_analysis) =
        compute_narrator(first_person_count, pov_switch_count, char_count);

    // --- 感情 ---
    let (positive_word_count, negative_word_count, tension_word_count, emotion_curve) =
        compute_emotion(&plain, char_count);

    // --- 文章 ---
    let kanji_rate_val = kanji_count as f64 / total;
    let readability_score = compute_readability_score(avg_sentence_length, kanji_rate_val, difficult_word_rate);
    let writing_rhythm = compute_writing_rhythm(&plain);

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
        word_frequencies,
        vocabulary_diversity,
        unique_token_count,
        total_token_count,
        rhythm_variance,
        rhythm_stddev,
        dialogue_narrative_pattern,
        scene_break_count,
        scene_break_density,
        estimated_structure,
        climax_position,
        intensity_curve,
        polite_form_count,
        plain_form_count,
        polite_form_ratio,
        mixed_style_warnings,
        estimated_reading_minutes,
        difficult_kanji,
        unique_kanji_count,
        avg_paragraph_length,
        max_sentence_length,
        paragraph_lengths,
        verb_density,
        adj_density,
        psycho_density,
        difficult_word_rate,
        metaphor_rate,
        katakana_word_count,
        verb_count,
        adj_count,
        psycho_word_count,
        metaphor_count,
        first_person_count,
        pov_switch_count,
        question_sentence_count,
        narrator_type,
        narrator_analysis,
        positive_word_count,
        negative_word_count,
        tension_word_count,
        emotion_curve,
        readability_score,
        writing_rhythm,
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

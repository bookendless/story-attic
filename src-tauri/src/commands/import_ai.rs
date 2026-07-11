use crate::parsers::{parse_content, ParsedStoryProject, ParsedRelationship};
use crate::AppState;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::State;
use uuid::Uuid;

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportOptions {
    pub target_project_id: Option<String>,
    pub sections: ImportSections,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSections {
    pub characters: bool,
    pub plot: bool,
    pub synopsis: bool,
    pub chapters: bool,
    pub draft: bool,
    pub glossary: bool,
    pub relationships: bool,
    pub world_settings: bool,
    pub plot_threads: bool,
    pub timeline: bool,
}

impl Default for ImportSections {
    fn default() -> Self {
        Self {
            characters: true,
            plot: true,
            synopsis: true,
            chapters: true,
            draft: true,
            glossary: true,
            relationships: true,
            world_settings: true,
            plot_threads: true,
            timeline: true,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResult {
    pub project_id: String,
    pub counts: ImportCounts,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct ImportCounts {
    pub characters: usize,
    pub chapters: usize,
    pub episodes: usize,
    pub glossary_items: usize,
    pub relationships: usize,
    pub world_settings: usize,
    pub plot_threads: usize,
    pub synopsis: usize,
    pub plot_phases: usize,
    pub timeline_events: usize,
}

/// AI Story Builder ファイルをパースしてプレビュー用データを返す（DB書き込みなし）
#[tauri::command]
pub fn parse_ai_story_builder_file(path: String) -> CmdResult<ParsedStoryProject> {
    let p = std::path::Path::new(&path);

    // .txt / .md を許可
    match p.extension().and_then(|s| s.to_str()) {
        Some("txt") | Some("md") => {}
        _ => return Err("テキストファイル（.txt / .md）のみインポート可能です".into()),
    }

    // 10MB 以下に制限
    let meta = std::fs::metadata(p)
        .map_err(|e| format!("ファイル情報の取得に失敗しました: {}", e))?;
    if meta.len() > 10 * 1024 * 1024 {
        return Err("ファイルサイズが大きすぎます（上限: 10MB）".into());
    }

    let content = std::fs::read_to_string(p)
        .map_err(|e| format!("ファイル読み込みエラー: {}", e))?;
    Ok(parse_content(&content))
}

/// パース済みデータをDBにインポートする（トランザクション内で全テーブル一括投入）
#[tauri::command]
pub fn import_ai_story_builder(
    parsed: ParsedStoryProject,
    options: ImportOptions,
    state: State<AppState>,
) -> CmdResult<ImportResult> {
    let conn = state.db.lock().map_err(err)?;
    conn.execute_batch("BEGIN").map_err(err)?;
    let result = (|| -> CmdResult<ImportResult> {
    let mut counts = ImportCounts::default();

    // プロジェクトID決定（新規 or 既存）
    let project_id = match &options.target_project_id {
        Some(id) => id.clone(),
        None => {
            let new_id = Uuid::new_v4().to_string();
            let now = chrono::Utc::now().to_rfc3339();

            // 基本情報をsettings JSONに格納
            let settings_json = serde_json::json!({
                "genre": parsed.basic_info.genre,
                "subGenre": parsed.basic_info.sub_genre,
                "targetReaders": parsed.basic_info.target_readers,
                "theme": parsed.basic_info.theme,
                "importedFrom": "ai_story_builder",
                "importDate": now,
            })
            .to_string();

            conn.execute(
                "INSERT INTO projects (id, title, author, description, settings, created_at, updated_at)
                 VALUES (?1, ?2, '', ?3, ?4, ?5, ?5)",
                rusqlite::params![new_id, parsed.title, parsed.overview, settings_json, now],
            )
            .map_err(err)?;

            new_id
        }
    };

    // キャラクター
    let mut char_name_to_id: HashMap<String, String> = HashMap::new();
    if options.sections.characters {
        for (i, ch) in parsed.characters.iter().enumerate() {
            let id = Uuid::new_v4().to_string();
            let profile_json = serde_json::json!({
                "profile": {
                    "gender": "",
                    "age": extract_age_from_meta(&ch.meta),
                    "occupation": extract_role_from_meta(&ch.meta),
                    "appearance": ch.appearance,
                    "personality": ch.personality,
                    "background": ch.background,
                    "speechStyle": ch.speech_style
                },
                "tabs": [],
                "extra_fields": [
                    { "label": "メタ情報", "value": ch.meta }
                ]
            })
            .to_string();

            conn.execute(
                "INSERT INTO characters (id, project_id, category, name, data, sort_order)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![
                    id,
                    project_id,
                    extract_role_from_meta(&ch.meta),
                    ch.name,
                    profile_json,
                    i as i64
                ],
            )
            .map_err(err)?;

            char_name_to_id.entry(ch.name.clone()).or_insert(id);
            counts.characters += 1;
        }
    }

    // あらすじ
    if options.sections.synopsis && !parsed.synopsis.is_empty() {
        let synopsis_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO synopses (id, project_id, content, created_at, updated_at)
             VALUES (?1, ?2, ?3, datetime('now'), datetime('now'))
             ON CONFLICT(project_id) DO UPDATE SET content = excluded.content, updated_at = datetime('now')",
            rusqlite::params![synopsis_id, project_id, parsed.synopsis],
        )
        .map_err(err)?;
        counts.synopsis = 1;
    }

    // プロット
    if options.sections.plot {
        import_plot(&conn, &project_id, &parsed, &mut counts)?;
    }

    // 章
    let mut chapter_title_to_id: HashMap<String, String> = HashMap::new();
    if options.sections.chapters {
        let now_ch = chrono::Utc::now().to_rfc3339();
        for (i, ch) in parsed.chapters.iter().enumerate() {
            let id = Uuid::new_v4().to_string();
            let full_title = format!("第{}章: {}", ch.number, ch.title);
            conn.execute(
                "INSERT INTO chapters (id, project_id, title, summary, setting, mood, important_events, sort_order, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                rusqlite::params![id, project_id, full_title, ch.summary, ch.setting, ch.mood, ch.important_events, i as i64, now_ch],
            )
            .map_err(err)?;

            chapter_title_to_id.insert(ch.title.clone(), id.clone());
            chapter_title_to_id.insert(full_title, id);
            counts.chapters += 1;
        }
    }

    // 草案 → エピソード
    if options.sections.draft {
        let now = chrono::Utc::now().to_rfc3339();
        for (i, draft) in parsed.drafts.iter().enumerate() {
            let ep_id = Uuid::new_v4().to_string();
            let title = draft
                .chapter_ref
                .clone()
                .unwrap_or_else(|| format!("草案 {}", i + 1));

            conn.execute(
                "INSERT INTO episodes (id, project_id, title, body, sort_order, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
                rusqlite::params![ep_id, project_id, title, draft.body, i as i64, now],
            )
            .map_err(err)?;

            // 対応する章にリンク
            if let Some(ref chapter_ref) = draft.chapter_ref {
                if let Some(chapter_id) = chapter_title_to_id.get(chapter_ref) {
                    conn.execute(
                        "INSERT OR IGNORE INTO chapter_episodes (chapter_id, episode_id, sort_order)
                         VALUES (?1, ?2, ?3)",
                        rusqlite::params![chapter_id, ep_id, 0i64],
                    )
                    .map_err(err)?;
                }
            }

            counts.episodes += 1;
        }
    }

    // 用語集
    if options.sections.glossary {
        for (i, item) in parsed.glossary.iter().enumerate() {
            let id = Uuid::new_v4().to_string();
            let data_json = serde_json::json!({
                "reading": item.reading,
                "description": item.definition,
                "related": ""
            })
            .to_string();

            conn.execute(
                "INSERT INTO glossary (id, project_id, category, term, data, sort_order)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![
                    id,
                    project_id,
                    item.term_type,
                    item.term,
                    data_json,
                    i as i64
                ],
            )
            .map_err(err)?;

            counts.glossary_items += 1;
        }
    }

    // キャラクター相関図
    if options.sections.relationships && !parsed.relationships.is_empty() {
        import_relationships(&conn, &project_id, &parsed.relationships, &char_name_to_id, &mut counts)?;
    }

    // 世界観設定 → materials
    if options.sections.world_settings {
        for (i, ws) in parsed.world_settings.iter().enumerate() {
            let id = Uuid::new_v4().to_string();
            let data_json = serde_json::json!({
                "content": ws.content,
                "source": "AI Story Builder",
                "url": ""
            })
            .to_string();

            conn.execute(
                "INSERT INTO materials (id, project_id, book, category, title, data, sort_order)
                 VALUES (?1, ?2, '世界観設定', ?3, ?4, ?5, ?6)",
                rusqlite::params![
                    id,
                    project_id,
                    ws.category,
                    ws.title,
                    data_json,
                    i as i64
                ],
            )
            .map_err(err)?;

            counts.world_settings += 1;
        }
    }

    // 伏線トラッカー
    if options.sections.plot_threads {
        for (i, pt) in parsed.plot_threads.iter().enumerate() {
            let id = Uuid::new_v4().to_string();
            let data_json = serde_json::to_string(&serde_json::json!({
                "status": pt.status,
                "importance": pt.importance,
                "description": pt.description,
                "points": pt.points.iter().map(|p| serde_json::json!({
                    "type": p.point_type,
                    "chapter": p.chapter,
                    "content": p.content
                })).collect::<Vec<_>>(),
                "relatedCharacters": pt.related_characters,
                "resolution": pt.resolution,
                "notes": pt.notes,
                "recommendedPlacement": pt.recommended_placement,
                "expectedEffect": pt.expected_effect,
                "recoveryChapter": pt.recovery_chapter
            }))
            .map_err(err)?;

            conn.execute(
                "INSERT INTO plot_threads (id, project_id, title, category, data, sort_order, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'), datetime('now'))",
                rusqlite::params![id, project_id, pt.title, pt.category, data_json, i as i64],
            )
            .map_err(err)?;

            counts.plot_threads += 1;
        }
    }

    // タイムライン
    if options.sections.timeline && !parsed.timeline.is_empty() {
        let tl_id = Uuid::new_v4().to_string();
        let headers = vec!["#", "日付", "タイトル", "カテゴリ", "関連キャラクター", "説明"];
        let rows: Vec<Vec<serde_json::Value>> = parsed
            .timeline
            .iter()
            .map(|ev| {
                let cells = vec![
                    ev.number.to_string(),
                    ev.date.clone(),
                    ev.title.clone(),
                    ev.category.clone(),
                    ev.related_characters.join("、"),
                    ev.description.clone(),
                ];
                cells
                    .into_iter()
                    .map(|v| serde_json::json!({ "value": v }))
                    .collect()
            })
            .collect();

        let data_json = serde_json::json!({
            "headers": headers,
            "rows": rows,
        })
        .to_string();

        conn.execute(
            "INSERT INTO timelines (id, project_id, chapter_id, title, data) VALUES (?1, ?2, NULL, ?3, ?4)",
            rusqlite::params![tl_id, project_id, "タイムライン", data_json],
        )
        .map_err(err)?;

        counts.timeline_events = parsed.timeline.len();
    }

    Ok(ImportResult { project_id, counts })
    })();
    match result {
        Ok(r) => { conn.execute_batch("COMMIT").map_err(err)?; Ok(r) }
        Err(e) => { let _ = conn.execute_batch("ROLLBACK"); Err(e) }
    }
}

/** ASB の日本語構造名を PlotStructureType キーへ正規化 */
fn normalize_structure_type(label: &str) -> String {
    match label.trim() {
        "起承転結" => "kishotenketsu".to_string(),
        "三幕構成" => "three-act".to_string(),
        "四幕構成" => "four-act".to_string(),
        "ヒーローズ・ジャーニー" | "ヒーローズジャーニー" => "heroes-journey".to_string(),
        "ビートシート" => "beat-sheet".to_string(),
        "ミステリー・サスペンス" | "ミステリーサスペンス" => "mystery-suspense".to_string(),
        "" => String::new(),
        other => other.to_string(),
    }
}

fn import_plot(conn: &Connection, project_id: &str, parsed: &ParsedStoryProject, counts: &mut ImportCounts) -> CmdResult<()> {
    let plot = &parsed.plot;
    let structure_key = normalize_structure_type(&plot.structure_type);

    // plot_structure テーブルに ASB 基準 6 項目を保存
    let structure_data = serde_json::json!({
        "theme": plot.theme,
        "setting": plot.setting,
        "hook": plot.hook,
        "protagonistGoal": plot.protagonist_goal,
        "mainObstacles": plot.main_obstacles,
        "ending": plot.ending,
        "structureType": structure_key,
    })
    .to_string();

    conn.execute(
        "INSERT OR REPLACE INTO plot_structure (project_id, data) VALUES (?1, ?2)",
        rusqlite::params![project_id, structure_data],
    )
    .map_err(err)?;

    // 各フェーズを plots テーブルに保存
    if !plot.phases.is_empty() {
        let structure_type: &str = if structure_key.is_empty() {
            "カスタム"
        } else {
            &structure_key
        };

        let id = Uuid::new_v4().to_string();

        // ツリー形式のノードに変換
        let nodes: Vec<serde_json::Value> = plot.phases.iter().map(|phase| {
            let node_id = Uuid::new_v4().to_string();
            serde_json::json!({
                "id": node_id,
                "label": phase.label,
                "content": phase.content,
                "children": []
            })
        }).collect();

        let data_json = serde_json::json!({ "nodes": nodes }).to_string();

        conn.execute(
            "INSERT INTO plots (id, project_id, title, plot_type, theme, data, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0)",
            rusqlite::params![
                id,
                project_id,
                format!("プロット ({})", structure_type),
                structure_type,
                plot.theme,
                data_json
            ],
        )
        .map_err(err)?;
        counts.plot_phases = plot.phases.len();
    }

    Ok(())
}

fn import_relationships(
    conn: &Connection,
    project_id: &str,
    relationships: &[ParsedRelationship],
    char_map: &HashMap<String, String>,
    counts: &mut ImportCounts,
) -> CmdResult<()> {
    let corr_id = Uuid::new_v4().to_string();

    // ノード生成（キャラクター名 → UUID マッピング）
    let mut node_map: HashMap<String, String> = HashMap::new();
    for rel in relationships {
        for name in [&rel.from_name, &rel.to_name] {
            if !node_map.contains_key(name.as_str()) {
                node_map.insert(name.clone(), Uuid::new_v4().to_string());
            }
        }
    }

    let nodes: Vec<serde_json::Value> = node_map
        .iter()
        .map(|(name, node_id)| {
            serde_json::json!({
                "id": node_id,
                "name": name,
                "characterId": char_map.get(name).cloned().unwrap_or_default()
            })
        })
        .collect();

    let edges: Vec<serde_json::Value> = relationships
        .iter()
        .map(|rel| {
            serde_json::json!({
                "from": node_map.get(&rel.from_name).cloned().unwrap_or_default(),
                "to": node_map.get(&rel.to_name).cloned().unwrap_or_default(),
                "type": rel.relation_type,
                "intensity": rel.intensity,
                "description": rel.description,
                "notes": rel.notes
            })
        })
        .collect();

    let data_json = serde_json::json!({
        "nodes": nodes,
        "edges": edges
    })
    .to_string();

    conn.execute(
        "INSERT INTO correlations (id, project_id, title, data) VALUES (?1, ?2, '相関図', ?3)",
        rusqlite::params![corr_id, project_id, data_json],
    )
    .map_err(err)?;

    counts.relationships += relationships.len();
    Ok(())
}

/// メタ情報から年齢文字列を抽出する
fn extract_age_from_meta(meta: &str) -> String {
    // `29歳` `16歳` パターン
    for part in meta.split(['。', '，', ',', '・']) {
        let t = part.trim();
        if t.ends_with('歳') {
            return t.to_string();
        }
        // `16歳、` などの場合は読み取れることがある
        for word in t.split_whitespace() {
            if word.ends_with('歳') {
                return word.to_string();
            }
        }
    }
    String::new()
}

/// メタ情報から役割を抽出する（最初の部分）
fn extract_role_from_meta(meta: &str) -> String {
    // `主人公。29歳。` → `主人公`
    meta.split(['。', '，', ','])
        .next()
        .map(|s| s.trim().to_string())
        .unwrap_or_default()
}

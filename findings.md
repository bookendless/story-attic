# StoryAttic — 調査・発見事項

**作成日:** 2026-03-29

---

## 技術スタック確認

### Tauri v2
- `invoke()` でRust関数を呼び出す（同期的）
- `emit()` でRust → Reactへリアルタイム通知
- `tauri-plugin-sql` でSQLiteを操作（フロントからも `Database.execute()` 可能だが、セキュリティ上Rustコマンド経由を推奨）
- データ保存先: `%APPDATA%\StoryAttic\`（Tauriデフォルト）

### Tiptap v2
- `StarterKit` で基本編集機能を提供
- カスタムNode（`RubyNode`）とカスタムMark（`DotenMark`）で日本語小説特有の記法を実装
- `@tiptap/extension-search-and-replace` で検索・置換
- **既知の問題:** `writing-mode: vertical-rl` はProseMirrorの座標計算と干渉する場合がある → Phase 1早期にスパイク実施が必要

### dnd-kit
- `@dnd-kit/core` + `@dnd-kit/sortable` で話・章のD&D並べ替えを実装
- 縦書きモードとの干渉に注意

### Web Audio API
- フロント完結でサウンド実装可能（Rust側不要）
- 音源ファイル（`.ogg` / `.mp3`）はTauriアセットとしてバンドル
- オフライン環境でも動作

---

## 既存ファイル確認

### プロジェクトルート（d:/Dev/story-attic/）
- `plans/implementation_plan.md` — 既存の実装計画（Phase 1のファイル一覧あり）
- `specs/2026-03-27-story-attic-design.md` — 設計ドキュメント（承認済み）
- `SQLiteスキーマ設計.txt` — DBスキーマの参考資料
- `UIデザイン — 「StoryAttic」のビジュアル言語.txt` — UIデザイン参考資料
- `フェーズ1 詳細設計.txt` — Phase 1の詳細設計参考資料
- `プロジェクト構造.txt` — ディレクトリ構造の参考資料
- `ホーム画面（プロジェクト一覧).txt` — ホーム画面の参考資料
- **src-tauri / src ディレクトリはまだ存在しない**（新規構築が必要）

---

## SQLiteスキーマ（コアテーブル）

```sql
projects, episodes, chapters, chapter_episodes  -- Phase 1コア
characters, glossary, memos, materials, tags     -- Phase 4
plots, plot_structure, timelines                 -- Phase 4
mindmaps, correlations                           -- Phase 5
history_snapshots, diary_entries                 -- Phase 4
ai_settings, ai_conversations                    -- Phase 3
```

---

## カラーパレット（CSS変数）

```css
--bg-deep:       #1a1714;
--bg:            #242019;
--bg-surface:    #2e2923;
--bg-elevated:   #3a332c;
--text:          #e8e0d4;
--text-mid:      #b8ad9e;
--text-muted:    #7a7068;
--accent:        #c4956a;
--accent-hover:  #d4a87a;
--accent-soft:   #c4956a33;
--border:        #3e3730;
--border-light:  #4a423a;
--success:       #7aad8a;
--warning:       #c9a55a;
--danger:        #b07070;
--lamp:          #f5e6c8;
```

---

## Rustコマンド一覧（Phase 1）

```rust
// プロジェクト管理
create_project(title: String) -> ProjectId
list_projects() -> Vec<ProjectSummary>
get_project(id: String) -> Project
update_project(id: String, data: ProjectUpdate) -> ()
delete_project(id: String) -> ()

// エピソード管理
create_episode(project_id: String, title: String) -> EpisodeId
get_episode(id: String) -> Episode
save_episode(id: String, body: String) -> ()
rename_episode(id: String, title: String) -> ()
delete_episode(id: String) -> ()
reorder_episode(id: String, new_sort_order: i32) -> ()

// 章管理
create_chapter(project_id: String, title: String) -> ChapterId
rename_chapter(id: String, title: String) -> ()
delete_chapter(id: String) -> ()
reorder_chapter(id: String, new_sort_order: i32) -> ()
assign_episode_to_chapter(episode_id: String, chapter_id: String) -> ()
unassign_episode(episode_id: String) -> ()

// インポート / エクスポート
export_project_json(project_id: String) -> FilePath
import_project_json(file_path: String) -> ProjectId
export_episodes_txt(project_id: String, episode_ids: Vec<String>) -> FilePath
export_episodes_zip(project_id: String) -> FilePath
import_txt_files(project_id: String, file_paths: Vec<String>) -> Vec<EpisodeId>

// 設定
get_settings(project_id: String) -> Settings
save_settings(project_id: String, settings: Settings) -> ()
```

---

## リスク・注意事項

| リスク | 対処方針 |
|---|---|
| Tiptap縦書き座標干渉 | Phase 1最初期にスパイク実施、問題があれば代替実装（CSS組み合わせ）を検討 |
| レガシーJSONインポートの複雑性 | Phase 1完了定義から除外、独立タスクとして後回し |
| タグの孤立行 | `tags`テーブルはポリモーフィック設計のため外部キー制約不可 → Rustコマンドで明示的削除 |
| APIキー漏洩 | Windows Credential Manager 必須、DBやJSONエクスポートにAPIキーを含めない |
| 右パネルのPhase 4追加コスト | Phase 1から3カラム構成でwidth=0で隠しておく |

# StoryAttic — タスク計画

**作成日:** 2026-03-29
**ステータス:** 計画中
**現在フェーズ:** Phase 1（未着手）

---

## 全体フェーズ概要

| フェーズ | 内容 | ステータス |
|---|---|---|
| Phase 1 | エディタ基盤 + ファイル管理 + I/O | 未着手 |
| Phase 2 | 文章分析 + 校正 + 設定画面 | 未着手 |
| Phase 3 | AI連携 + 演出・サウンド・キャラウィジェット | 未着手 |
| Phase 4 | 執筆補助データ群 | 未着手 |
| Phase 5 | ビジュアルデータ（マインドマップ・相関図） | 未着手 |

---

## Phase 1 詳細タスク

### 1-A. プロジェクト初期化
- [ ] `pnpm create tauri-app` で Tauri v2 + React 19 + TypeScript 雛形を生成
- [ ] `pnpm` / `cargo` の依存パッケージを追加（Zustand・Tailwind・Tiptap・dnd-kit・tauri-plugin-sql 等）
- [ ] `tailwind.config.ts` にカラーパレット（`--bg-deep` / `--accent` 等）を定義
- [ ] `src/styles/globals.css` にCSS変数・タイポグラフィ（Shippori Mincho / Noto Sans JP）を設定
- [ ] `vite.config.ts` を整備

### 1-B. SQLite 基盤（Rust）
- [ ] `src-tauri/src/db/migrations/001_initial.sql` を作成（全テーブル定義）
- [ ] Rust起動時に `PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;` を実行
- [ ] `db/schema.rs` にテーブル操作の共通ヘルパーを実装
- [ ] `tauri-plugin-sql` を `tauri.conf.json` に登録

### 1-C. Rustコマンド実装
- [ ] `commands/project.rs` — create / list / get / update / delete
- [ ] `commands/episode.rs` — create / get / save / rename / delete / reorder
- [ ] `commands/chapter.rs` — create / rename / delete / reorder / assign / unassign
- [ ] `commands/file_io.rs` — export_json / import_json / export_txt / export_zip / import_txt
- [ ] `commands/settings.rs` — get_settings / save_settings
- [ ] `models/` — ProjectSummary / Project / Episode / Chapter 等の構造体定義
- [ ] `main.rs` に全コマンドを登録

### 1-D. Zustand ストア（フロントエンド）
- [ ] `shared/stores/appStore.ts` — currentView / currentProjectId
- [ ] `shared/stores/projectStore.ts` — projects / currentProject / CRUD アクション
- [ ] `shared/stores/editorStore.ts` — episodes / chapters / currentEpisodeId / isDirty / save
- [ ] `shared/stores/uiStore.ts` — パネル表示状態 / tategaki / settings

### 1-E. ルーティング & レイアウト
- [ ] `app/router.tsx` — home / workspace ビュー切替
- [ ] `app/Layout.tsx` — 共通ラッパー
- [ ] `app/App.tsx` — エントリポイント・ルーター設定

### 1-F. ホーム画面
- [ ] `features/project/HomePage.tsx`
- [ ] `HomeHeader` — ロゴ + 設定ボタン
- [ ] `ProjectGrid` — 作品カード一覧
- [ ] `ProjectCard` — タイトル・総文字数・話数・最終更新日
- [ ] `NewProjectCard` — 新規作成カード（タイトル入力ダイアログ）
- [ ] 削除確認ダイアログ
- [ ] JSONエクスポート / インポートボタン

### 1-G. ワークスペースレイアウト
- [ ] `WorkspaceHeader` — HomeButton / ProjectTitle / EpisodeTitle / SaveButton / SearchToggle / TategakiToggle / SettingsButton
- [ ] `WorkspaceBody` — 3カラム構成（左220px / エディタ可変 / 右0px=隠し）
- [ ] `LeftPanel` — ChapterTree + UngroupedList
- [ ] `RightPanel` — Phase 1はプレースホルダー（width: 0で隠す）

### 1-H. 左パネル操作
- [ ] `ChapterGroup` — 折りたたみ可能な章グループ
- [ ] `EpisodeItem` — D&D対応（dnd-kit）・リネーム・削除・右クリックメニュー
- [ ] 章管理モーダル（作成・リネーム・削除・並べ替え）
- [ ] 話を章にD&Dで割り当て

### 1-I. Tiptap エディタ
- [ ] **スパイク:** 縦書きモード（`writing-mode: vertical-rl`）の動作確認を最初に実施
- [ ] `EditorArea.tsx` — Tiptap本体・StarterKit設定
- [ ] `extensions/RubyNode.ts` — `|漢字《かんじ》` 記法
- [ ] `extensions/DotenMark.ts` — `text-emphasis` CSS
- [ ] InputRule: `---` → `――` 自動変換
- [ ] 自動字下げ（Enter時に全角スペース挿入）
- [ ] `@tiptap/extension-search-and-replace` 統合
- [ ] `SearchBar.tsx` — 検索・置換バー（Ctrl+F トグル）
- [ ] `StatusBar.tsx` — 文字数・行数・ページ数
- [ ] debounce 300ms でストア更新 + isDirty フラグ
- [ ] Ctrl+S 保存バインド

### 1-J. インポート / エクスポート
- [ ] `.story-attic.json` エクスポート（Rust: 全テーブルをproject_idでフィルタ）
- [ ] `.story-attic.json` インポート（Rust: バリデーション → 新ID付与 → 挿入）
- [ ] テキスト出力（`.txt` 話単位 / 全話）
- [ ] ZIP出力（`.zip` 全話まとめ、`zip`クレート使用）
- [ ] テキスト取込（`.txt` 複数ファイル → 1話ずつ）
- [ ] ※ レガシーJSON（旧HTML版）インポートは独立タスクとして後回し

### 1-K. 品質・テスト
- [ ] `cargo test` — DB マイグレーション成功確認
- [ ] `vitest` — RubyNode / DotenMark 単体テスト
- [ ] 手動動作確認（新規作成・執筆・保存・再起動後データ保持・JSONエクスポート）
- [ ] Lint（`eslint` / `cargo clippy`）パス確認

---

## Phase 2 詳細タスク（概要）

- [ ] `features/analysis/` — 文章分析モーダル（統計・語彙・品詞・感情・視点切替）
- [ ] `features/analysis/` — 校正機能（バックグラウンド処理 / Rust: `analyze_text` / `run_proofread`）
- [ ] `StatusBar` — 校正件数表示 + クリックで一覧
- [ ] 設定画面（自動保存間隔・字下げ・校正カテゴリ別ON/OFF 等）

---

## Phase 3 詳細タスク（概要）

- [ ] `features/ai/` — AI連携パネル（OpenAI / Anthropic / ローカルLLM / ストリーミング）
- [ ] Windows Credential Manager への APIキー保存（`keyring` クレート）
- [ ] `features/ambience/` — 雨アニメーション（Canvas/CSS）
- [ ] `features/ambience/` — キャラクターウィジェット（アニメーション・ドラッグ・つぶやき）
- [ ] Web Audio API — 環境音（ループ）/ タイピング音 / キャラクター効果音

---

## Phase 4 詳細タスク（概要）

- [ ] `features/plot/` — プロット & タイムライン
- [ ] `features/characters/` — 登場人物管理（カスタムタブ・タグ）
- [ ] `features/glossary/` / `features/memo/` / `features/material/` — 各データ管理
- [ ] `features/writing-support/` — 目標・タイマー・日記・履歴
- [ ] `RightPanel` — タブ切替実装（プロット / 人物 / 用語 / 資料 / メモ）
- [ ] エディタ上の選択語句ポップアップ（用語集・資料から検索）
- [ ] タグシステム — エンティティ削除時に`tags`テーブルの対応行を明示的に削除

---

## Phase 5 詳細タスク（概要）

- [ ] `features/mindmap/` — SVGキャンバス・ノード追加・削除・色変更・自動レイアウト
- [ ] `features/correlation/` — 相関図（ノード・エッジ・グループ・タグフィルタ）

---

## 設計上の決定事項

| 項目 | 決定内容 |
|---|---|
| DBエンジン | SQLite（`tauri-plugin-sql`）、WAL + 外部キー制約必須 |
| APIキー保管 | Windows Credential Manager（`keyring` クレートまたは `tauri-plugin-stronghold`） |
| 右パネル | Phase 1から3カラム構成、width=0で隠す |
| レガシーインポート | Phase 1完了定義から除外、独立タスク |
| 縦書きスパイク | Phase 1最初期に実施し、問題があれば代替実装を検討 |
| タグ孤立行防止 | Rustコマンド内で対象エンティティ削除時に明示的に`tags`テーブルも削除 |
| サウンド実装 | Web Audio API（フロント完結）、音源ファイルはTauriアセットとしてバンドル |

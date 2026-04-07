# StoryAttic — 進捗ログ

---

## セッション 1 — 2026-03-29

### 実施内容

- 設計ドキュメント（`specs/2026-03-27-story-attic-design.md`）を読み込み、全体構成を把握
- 既存の `plans/implementation_plan.md` を確認（Phase 1ファイル一覧あり）
- プランニングファイル3点を作成：
  - `task_plan.md` — 全フェーズのタスクブレークダウン
  - `findings.md` — 技術調査・既存ファイル確認・リスク整理
  - `progress.md` — 本ファイル（セッションログ）

### 完了アクション（セッション1）

- [x] pnpm インストール（v10.33.0）
- [x] 全プロジェクト設定ファイル作成（package.json / vite.config.ts / tsconfig.json / tailwind.config.ts / postcss.config.js）
- [x] Tauriバックエンド設定（Cargo.toml / tauri.conf.json / build.rs / capabilities/default.json）
- [x] SQLiteスキーマ作成（001_initial.sql 全テーブル）
- [x] Rust DB初期化（WAL + 外部キー + マイグレーション管理）
- [x] Rustコマンド実装（project / episode / chapter / file_io / settings）
- [x] フロントエンド基盤（globals.css / Zustandストア4本 / App.tsx / main.tsx）
- [x] 共通型定義（shared/types/index.ts）
- [x] ホーム画面（HomePage / ProjectCard / NewProjectCard / ImportExportButtons）
- [x] ワークスペースレイアウト（WorkspacePage 3カラム）
- [x] WorkspaceHeader（保存・検索・縦書き・出力メニュー）
- [x] 左パネル（LeftPanel / ChapterGroup / EpisodeItem / SortableEpisodeItem / ChapterModal）
- [x] Tiptapエディタ（EditorArea / StatusBar / SearchBar）
- [x] カスタム拡張（RubyNode / DotenMark / AutoIndent / DashRule）
- [x] インポート/エクスポート（ExportMenu: JSON/TXT/ZIP/テキスト取込）
- [x] TypeScript tsc --noEmit: PASS
- [x] cargo check / cargo clippy: PASS
- [x] ESLint: PASS

### 注記

- `@tiptap/extension-search-and-replace` はProプランのため `@sereneinserenade/tiptap-search-and-replace` を使用
- 縦書きスパイクはCSS `writing-mode: vertical-rl` を `editor-tategaki` クラスで実装済み（実機での動作確認は次セッション）
- アイコンファイルは `pnpm exec tauri icon app-icon.png` で生成（琥珀色プレースホルダー）

### 次のアクション

- [ ] `pnpm tauri dev` でアプリを起動して動作確認
- [ ] 縦書きモードの実機動作確認（Tiptap座標干渉の有無）
- [ ] エンドツーエンド動作テスト（新規作成 → 執筆 → 保存 → JSONエクスポート）

---

# StoryAttic — Windowsネイティブアプリ 設計ドキュメント

**作成日:** 2026-03-27
**ステータス:** 承認済み
**対象:** Tauri v2 + React + TypeScript による小説執筆ツール「StoryAttic」

---

## 1. プロジェクト概要

- 複数作品の管理（ホーム画面）
- SQLiteによるデータ永続化
- JSON形式による作品の入出力（可搬性）
- 「静寂さと穏やかな温かさ」をコンセプトとした新UIデザイン
- AI連携による「ユーザーへの寄り添い」機能の強化

### アプリ名

**StoryAttic**（ストーリーアティック）
コンセプト：屋根裏の書斎で、柔らかなランプの灯りのもとで物語を紡ぐ場所

---

## 2. 技術スタック

| レイヤー | 技術 | バージョン |
|---|---|---|
| デスクトップシェル | Tauri | v2 |
| バックエンド | Rust | stable |
| フロントエンド | React + TypeScript | React 19 |
| 状態管理 | Zustand | latest |
| スタイリング | Tailwind CSS + CSS Modules | latest |
| テキストエディタ | Tiptap（ProseMirrorベース） | v2 |
| データベース | SQLite（`tauri-plugin-sql`） | — |
| ビルドツール | Vite | latest |
| パッケージ管理 | pnpm | latest |
| テスト | Vitest + React Testing Library | latest |
| インストーラー | NSIS（Tauri標準出力） | — |

---

## 3. プロジェクト構造

```
story-attic/
├── src-tauri/                    # Rustバックエンド
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/             # Tauriコマンド（フロントから呼ぶAPI）
│   │   │   ├── mod.rs
│   │   │   ├── project.rs        # プロジェクトCRUD
│   │   │   ├── episode.rs        # エピソード管理
│   │   │   ├── chapter.rs        # 章管理
│   │   │   ├── file_io.rs        # インポート/エクスポート
│   │   │   ├── analysis.rs       # 文章分析（Rust側で高速処理）
│   │   │   ├── ai.rs             # AI API中継
│   │   │   └── settings.rs       # 設定管理
│   │   ├── db/                   # SQLiteスキーマ・マイグレーション
│   │   │   ├── mod.rs
│   │   │   ├── schema.rs
│   │   │   └── migrations/
│   │   │       └── 001_initial.sql
│   │   └── models/               # データ構造体
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── src/                          # Reactフロントエンド
│   ├── app/
│   │   ├── App.tsx               # ルートコンポーネント
│   │   ├── Layout.tsx            # 共通レイアウト
│   │   └── router.tsx            # ルーティング定義
│   ├── features/                 # 機能モジュール（フェーズ単位で追加）
│   │   ├── editor/               # エディタ基盤（Phase 1）
│   │   ├── project/              # ファイル・章管理（Phase 1）
│   │   ├── io/                   # インポート/エクスポート（Phase 1）
│   │   ├── analysis/             # 文章分析・校正（Phase 2）
│   │   ├── ai/                   # AI連携（Phase 3）
│   │   ├── ambience/             # 雨の演出・キャラウィジェット（Phase 3）
│   │   ├── characters/           # 登場人物管理（Phase 4）
│   │   ├── glossary/             # 用語集（Phase 4）
│   │   ├── memo/                 # メモ（Phase 4）
│   │   ├── material/             # 資料（Phase 4）
│   │   ├── plot/                 # プロット & タイムライン（Phase 4）
│   │   ├── writing-support/      # 執筆支援（Phase 4）
│   │   ├── mindmap/              # マインドマップ（Phase 5）
│   │   └── correlation/          # 相関図（Phase 5）
│   ├── shared/                   # 共通コンポーネント・ユーティリティ
│   │   ├── components/           # Modal, Button, Panel, TagPicker等
│   │   ├── hooks/                # useProject, useTauriCommand等
│   │   ├── stores/               # Zustandストア
│   │   ├── types/                # 共通型定義
│   │   └── utils/                # ユーティリティ
│   ├── styles/                   # グローバルスタイル・テーマ
│   └── main.tsx
│
├── package.json
├── vite.config.ts
├── tsconfig.json
└── tailwind.config.ts
```

---

## 4. UIデザイン — ビジュアル言語

### コンセプト

「屋根裏の書斎」。薄暗い屋根裏部屋で、柔らかなランプの灯りのもとで物語を紡ぐ。静寂でありながら冷たくなく、温かみのある「居心地の良い隠れ家」の空気感。

### カラーパレット

```css
:root {
  /* ベース（屋根裏の木材・闇） */
  --bg-deep:       #1a1714;  /* 最も暗い背景 */
  --bg:            #242019;  /* メイン背景 */
  --bg-surface:    #2e2923;  /* パネル・カード背景 */
  --bg-elevated:   #3a332c;  /* モーダル・ドロップダウン */

  /* テキスト */
  --text:          #e8e0d4;  /* 本文テキスト（温かいオフホワイト） */
  --text-mid:      #b8ad9e;  /* 補助テキスト */
  --text-muted:    #7a7068;  /* プレースホルダー・ラベル */

  /* アクセント（ランプの灯り・琥珀色） */
  --accent:        #c4956a;
  --accent-hover:  #d4a87a;
  --accent-soft:   #c4956a33;

  /* ボーダー */
  --border:        #3e3730;
  --border-light:  #4a423a;

  /* セマンティック */
  --success:       #7aad8a;
  --warning:       #c9a55a;
  --danger:        #b07070;

  /* 特殊 */
  --lamp:          #f5e6c8;  /* フォーカスリング・グロー */
}
```

### タイポグラフィ

| 用途 | フォント |
|---|---|
| ロゴ・見出し | Shippori Mincho |
| UI・ラベル | Noto Sans JP |
| エディタ本文 | ユーザー選択可（游明朝 / Noto Serif JP / BIZ UDMincho等） |

### デザイン原則

| 原則 | 実装 |
|---|---|
| 静けさ | アニメーションは緩やかなease-out（200〜300ms）。派手なトランジション禁止 |
| 温かさ | 影はすべてウォームブラック `rgba(20,16,12,.3)`。純粋な黒い影は使用しない |
| 奥行き | パネルの重なりは微細なシャドウ + わずかなボーダーで表現 |
| 余白 | コンポーネント間は十分なスペース。書斎の「ゆとり」を表現 |
| フォーカス | アクセント色のglow `0 0 8px var(--lamp)` で示す |

---

## 5. SQLiteスキーマ設計

### 設計方針

- **固定フィールドはカラムとして正規化**（title, category, sort_order等）— 検索・ソートを高速化
- **可変・複雑なフィールドはJSONカラムに格納**（カスタムタブ、ノードツリー等）
- **タグは共通テーブル**（entity_type + entity_idのポリモーフィック設計）
- **APIキーはOS標準キーチェーン**（Windows Credential Manager）で保護

### コアテーブル

```sql
-- プロジェクト（1つの「作品」に対応）
CREATE TABLE projects (
  id          TEXT PRIMARY KEY,           -- UUID
  title       TEXT NOT NULL,
  author      TEXT,
  description TEXT,
  settings    TEXT,                       -- JSON（アプリ設定）
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- エピソード（「話」に対応）
CREATE TABLE episodes (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',   -- 本文
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- 章
CREATE TABLE chapters (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

-- 章とエピソードの紐づけ
CREATE TABLE chapter_episodes (
  chapter_id  TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  episode_id  TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (chapter_id, episode_id)
);
```

### キャラクター・用語集・メモ・資料

```sql
CREATE TABLE characters (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category    TEXT NOT NULL DEFAULT '',
  name        TEXT NOT NULL,
  data        TEXT NOT NULL DEFAULT '{}', -- JSON（プロフィール・カスタムタブ）
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE glossary (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category    TEXT NOT NULL DEFAULT '',
  term        TEXT NOT NULL,
  data        TEXT NOT NULL DEFAULT '{}', -- JSON（読み・説明・関連情報）
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE memos (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category    TEXT NOT NULL DEFAULT '',
  title       TEXT NOT NULL,
  data        TEXT NOT NULL DEFAULT '{}',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- 資料（3階層: ブック → カテゴリ → アイテム）
CREATE TABLE materials (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  book        TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT '',
  title       TEXT NOT NULL,
  data        TEXT NOT NULL DEFAULT '{}',
  sort_order  INTEGER NOT NULL DEFAULT 0
);
```

### タグシステム（全エンティティ共通）

```sql
CREATE TABLE tags (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'character'|'glossary'|'memo'|'material'
  entity_id   TEXT NOT NULL,
  tag         TEXT NOT NULL,
  UNIQUE (project_id, entity_type, entity_id, tag)
);
```

### プロット & タイムライン

```sql
CREATE TABLE plots (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  plot_type   TEXT NOT NULL DEFAULT '起承転結',
  theme       TEXT,
  data        TEXT NOT NULL DEFAULT '{}', -- JSON（フェーズ・ノードツリー）
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE plot_structure (
  project_id  TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  -- プロジェクトと1対1。project_idをPKにして重複挿入を防ぐ
  data        TEXT NOT NULL DEFAULT '{}' -- JSON（テーマ・対立構造・結末一覧）
);

CREATE TABLE timelines (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  chapter_id  TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  data        TEXT NOT NULL DEFAULT '{}' -- JSON（行・列・セルデータ）
);
```

### マインドマップ & 相関図

```sql
CREATE TABLE mindmaps (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  data        TEXT NOT NULL DEFAULT '{}' -- JSON（ノードツリー・フリーエッジ）
);

CREATE TABLE correlations (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  data        TEXT NOT NULL DEFAULT '{}' -- JSON（ノード・エッジ・グループ）
);
```

### 執筆履歴 & 日記

```sql
CREATE TABLE history_snapshots (
  id          TEXT PRIMARY KEY,
  episode_id  TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  char_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE diary_entries (
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,              -- 'YYYY-MM-DD'
  char_count  INTEGER NOT NULL DEFAULT 0,
  session_sec INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, date)
);
```

### AI設定 & 会話履歴

```sql
CREATE TABLE ai_settings (
  project_id    TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  provider      TEXT,                     -- 'openai'|'anthropic'|'local'
  -- api_key はOSキーチェーンで管理（DBには保存しない）
  model         TEXT,
  system_prompt TEXT,
  data          TEXT NOT NULL DEFAULT '{}' -- JSON（その他設定）
);

CREATE TABLE ai_conversations (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  episode_id  TEXT REFERENCES episodes(id) ON DELETE SET NULL, -- 会話のコンテキスト（どの話での会話か）
  role        TEXT NOT NULL,              -- 'user'|'assistant'
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
```

---

## 6. JSONエクスポート形式

### ファイル仕様

- 拡張子: `.story-attic.json`
- エンコーディング: UTF-8
- フォーマットバージョン管理によりスキーマ変更時に自動マイグレーション対応

### 構造

```jsonc
{
  "format": "story-attic",
  "version": "1.0.0",
  "exported_at": "2026-03-27T12:00:00Z",
  "project": {
    "title": "作品タイトル",
    "author": "著者名",
    "description": "",
    "settings": {}
  },
  "chapters": [ { "id": "...", "title": "...", "sort_order": 0 } ],
  "chapter_episodes": [ { "chapter_id": "...", "episode_id": "...", "sort_order": 0 } ],
  "episodes": [ { "id": "...", "title": "...", "body": "...", "sort_order": 0 } ],
  "characters": [],
  "glossary": [],
  "memos": [],
  "materials": [],
  "tags": [],
  "plots": [],
  "plot_structure": {},
  "timelines": [],
  "mindmaps": [],
  "correlations": [],
  "diary_entries": [],
  "ai_settings": {}
  // ※ api_keyはセキュリティ上エクスポートから除外
}
```

---

## 7. フェーズ計画

### Phase 1（最優先）— エディタ基盤 + ファイル管理 + インポート/エクスポート

**成果物:** 「作品を作り、書いて、章で整理して、保存して、JSON/テキストで持ち出せる」アプリ

#### 7-1. ホーム画面

**機能:**
- 作品カード一覧（タイトル・総文字数・話数・最終更新日）
- 新規作品作成（タイトル入力ダイアログ）
- 作品を開く（カードクリック）
- 作品の削除（確認ダイアログ付き）
- JSONエクスポート / JSONインポート
- 現行HTML版JSONからの移行インポート

**コンポーネント:**
```
HomePage
├── HomeHeader          ロゴ + 設定ボタン
├── ProjectGrid
│   ├── ProjectCard     各作品カード
│   └── NewProjectCard  新規作成カード
└── ImportSection       インポートボタン群
```

#### 7-2. ワークスペースレイアウト

```
WorkspaceHeader
├── HomeButton          ホームに戻る（未保存警告あり）
├── ProjectTitle        作品名（クリックで編集）
├── EpisodeTitle        現在の話名
├── SaveButton          保存（Ctrl+S）
├── SearchToggle        検索・置換（Ctrl+F）
├── TategakiToggle      縦書き切替
└── SettingsButton      設定

WorkspaceBody
├── LeftPanel（220px）   話一覧・章管理
│   ├── PanelHeader
│   ├── ChapterTree
│   │   ├── ChapterGroup    折りたたみ可能な章
│   │   └── EpisodeItem     D&D・リネーム・削除対応
│   └── UngroupedList   章未割当の話
├── EditorArea（可変）
│   ├── SearchBar       検索・置換バー（トグル）
│   ├── Editor          Tiptapエディタ
│   └── StatusBar       文字数・行数・ページ数
└── RightPanel（200px）  Phase1ではプレースホルダー
```

#### 7-3. テキストエディタ（Tiptap拡張）

| 機能 | 実装 |
|---|---|
| 基本編集 | StarterKit |
| ルビ | カスタムNode `RubyNode`（`\|漢字《かんじ》` 記法） |
| 傍点 | カスタムMark `DotenMark`（text-emphasis CSS） |
| ダッシュ自動変換 | InputRule: `---` → `――` |
| 縦書き | `writing-mode: vertical-rl` をコンテナに適用 |
| 自動字下げ | カスタムキーバインド（Enter時に全角スペース挿入） |
| 検索・置換 | `@tiptap/extension-search-and-replace` |
| 投稿先フォーマット | エクスポート時に変換（なろう/Nola・カクヨム・ハーメルン） |

**データフロー:**
```
Editor.onUpdate
  → debounce(300ms)
  → Zustand store更新 + isDirty = true
  → StatusBar再描画

Ctrl+S / SaveButton
  → invoke('save_episode', { id, body })
  → Rust → SQLite
  → isDirty = false
```

#### 7-4. 左パネル操作

| 操作 | UIトリガー | Rustコマンド |
|---|---|---|
| 話の追加 | ＋ボタン | `create_episode` |
| 話の選択 | クリック | — |
| 話のリネーム | ダブルクリック | `rename_episode` |
| 話の削除 | 右クリックメニュー | `delete_episode` |
| 話の並べ替え | ドラッグ&ドロップ（dnd-kit） | `reorder_episode` |
| 章管理 | 「章」ボタン → モーダル | `create/rename/delete_chapter` |
| 章への割り当て | D&Dで話を章にドロップ | `assign_episode_to_chapter` |

#### 7-5. インポート / エクスポート（Phase 1対応形式）

| 操作 | 形式 | 実装場所 |
|---|---|---|
| 作品エクスポート | `.story-attic.json` | Rust: 全テーブルをproject_idでフィルタ → JSON生成 |
| 作品インポート | `.story-attic.json` | Rust: バリデーション → 新ID付与 → SQLite挿入 |
| 旧版移行 | 現行HTML版JSON | Rust: スキーマ変換レイヤー |
| テキスト出力 | `.txt`（話単位/全話） | Rust: 本文を結合してテキスト生成 |
| テキスト取込 | `.txt`（複数ファイル） | Rust: 各ファイルを1話として取り込み |
| ZIP出力 | `.zip`（複数txtをまとめて） | Rust: `zip`クレートで生成 |

#### 7-6. Rustコマンド一覧（Phase 1）

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
import_legacy_json(file_path: String) -> ProjectId
export_episodes_txt(project_id: String, episode_ids: Vec<String>) -> FilePath
export_episodes_zip(project_id: String) -> FilePath
import_txt_files(project_id: String, file_paths: Vec<String>) -> Vec<EpisodeId>

// 設定
get_settings(project_id: String) -> Settings
save_settings(project_id: String, settings: Settings) -> ()
```

#### 7-7. Zustandストア（Phase 1）

```typescript
// アプリ全体
useAppStore {
  currentView: 'home' | 'workspace'
  currentProjectId: string | null
}

// プロジェクト
useProjectStore {
  projects: ProjectSummary[]
  currentProject: Project | null
  loadProjects(): void
  openProject(id: string): void
  createProject(title: string): Promise<void>
  deleteProject(id: string): Promise<void>
}

// エディタ
useEditorStore {
  episodes: Episode[]
  chapters: Chapter[]
  currentEpisodeId: string | null
  isDirty: boolean
  switchEpisode(id: string): void
  updateBody(body: string): void
  save(): Promise<void>
}

// UI
useUIStore {
  leftPanelVisible: boolean
  rightPanelVisible: boolean
  searchBarVisible: boolean
  isTategaki: boolean
  settings: Settings
}
```

---

### Phase 2 — 文章分析 + 校正 + 設定画面

**成果物:** 執筆中のテキストを統計・校正で改善できる状態

#### 主要機能

**文章分析モーダル:**
- 基本統計（文字数・行数・段落数・文数）
- 語彙分析（TTR・難語率・カタカナ率）
- 品詞カウント（動詞・形容詞・心理描写・比喩）
- 感情分析（ポジティブ/ネガティブ/緊張感）
- 視点切替検出
- 折れ線グラフ（文長・台詞比率の推移）

**校正機能（バックグラウンド処理）:**
- 入力中にリアルタイムで問題を検出（Rust側で処理）
- 検出カテゴリ: 二重表現・誤用・冗長表現・語法・記号/句読点・副詞の呼応・小説特有の表現・表記ゆれ
- ステータスバーに件数表示、クリックで一覧表示

**設定画面:**
- 自動字下げ ON/OFF
- 自動保存 ON/OFF（間隔: 30秒/1分/3分/5分）
- 文字数カウント ON/OFF
- 校正機能 ON/OFF（カテゴリ別設定）
- 選択語句ポップアップ ON/OFF
- テキストボックス自動伸長
- 原稿設定（1行の文字数・1ページの行数）
- 執筆ラップ間隔（分）
- 執筆履歴の記録間隔（分）

**追加Rustコマンド:**
```rust
analyze_text(text: String) -> AnalysisResult
run_proofread(text: String, cats: Vec<String>) -> Vec<ProofIssue>
```

---

### Phase 3 — AI連携 + 演出・サウンド・キャラクターウィジェット（癒し機能）

**成果物:** AIによる執筆サポートと、執筆体験を豊かにする演出・サウンド

#### AI連携

**設定:**
- APIプロバイダー選択（OpenAI / Anthropic / ローカルLLM等）
- APIキーをWindows Credential Managerに保存
- モデル選択（APIから取得）
- システムプロンプトのカスタマイズ・プリセット選択
- 接続テスト機能

**チャット機能:**
- AIパネル（右サイドバーとして表示）
- クイックアクション（プリセットプロンプトテンプレート）
- コンテキスト送信（本文・キャラクター・用語集・資料をAIに渡す）
- 会話履歴の保持・クリア

**つぶやき機能:**
- 執筆の状況を検知してAIがキャラクターウィジェット経由でつぶやく
- キャラクター情報を踏まえた言及
- 励まし・感想・問いかけ等のトーン

#### 演出機能

**雨の演出:**
- エディタ背景に降る雨アニメーション（Canvas/CSS）
- 設定: 雨粒の量・速度・角度・長さ・透明度・夜雨モード（背景暗転）
- ヘッダーボタンでON/OFF切替

**キャラクターウィジェット:**
- デスクトップマスコット風キャラクターを画面に表示
- アニメーション: 回転・揺れ・ジャンプ・歩き・居眠り・伸び・思考・やった！等
- ドラッグで任意の位置に移動
- クリックでリアクション
- メッセージ吹き出し表示（つぶやき連携）
- リアクション音との連動（後述）

**サウンド機能（Web Audio API）:**

実装方式: フロントエンドのWeb Audio APIで完結（Rust側への実装不要）。
音源ファイル（`.ogg` / `.mp3`）はTauriアセットとしてバンドルし、オフライン環境でも動作する。

**環境音（ループ再生）:**

- 雨音（雨の演出と連動してON/OFF）
- 焚き火
- 森・虫の声
- カフェの雑音
- 波の音
- 複数音源の同時ミックス対応（例: 雨音 + 焚き火）

**タイピング音:**

- キーストロークに同期した打鍵音
- 音種の選択: 機械式キーボード・木製・静音・なし
- ボリューム独立調整

**キャラクターリアクション音:**

- ウィジェットのアニメーション（やった！/ 驚き / 居眠り等）に連動した短い効果音
- AIつぶやき発火時の通知音（控えめなチャイム等）

**設定項目（設定画面に追加）:**

- マスターボリューム
- 環境音ボリューム / 種類選択
- タイピング音ボリューム / 種類選択
- キャラクター音ボリューム
- サウンド全体のON/OFF

**追加Rustコマンド:**
```rust
ai_send_message(project_id: String, messages: Vec<AiMessage>) -> AiStream
ai_save_settings(project_id: String, settings: AiSettings) -> ()
ai_get_models(provider: String, api_key_ref: String) -> Vec<String>
```

---

### Phase 4 — 執筆補助データ群

**成果物:** プロット・キャラクター・用語集・メモ・資料・執筆支援機能が揃った状態

#### 含まれる機能

**プロット & タイムライン:**
- 複数プロットの管理、ツリー構造でノード追加・削除・編集
- プロット構成タイプ（起承転結・序破急・カスタム）
- 構造設定（テーマ・対立構造・結末管理）
- 章ごとのタイムラインテーブル（スプレッドシート型）

**登場人物管理:**
- カテゴリ分け、追加・削除・編集
- 詳細フィールド + カスタムタブ + エクストラフィールド
- タグ管理、登場箇所表示（エピソードとの紐づけ）

**用語集 / メモ / 資料:**
- 各カテゴリ分け + タグ + 詳細フィールド
- 資料は3階層（ブック→カテゴリ→アイテム）
- エディタ上での選択語句ポップアップ（用語集・資料から検索）

**執筆支援:**
- 目標文字数設定（話ごと / 全体）
- 締切設定 + カウントダウン表示
- 執筆ラップ（間隔ごとに文字数を記録）
- カウントダウンタイマー / チャレンジモード
- 執筆履歴（スナップショット + diff表示）
- 執筆日記（カレンダー + 連続執筆日数）

**右サイドパネル（Phase 4で実装）:**
- タブ切替: プロット / 人物 / 用語 / 資料 / メモ
- 執筆中に参照できるクイックビュー

---

### Phase 5 — ビジュアルデータ（最終フェーズ）

**成果物:** マインドマップ・相関図が使える完全版

**マインドマップ:**
- SVGキャンバス + ノード追加・削除・色変更
- 複数マップ管理、自動レイアウト
- 自由辺（フリーエッジ）、辺のスタイル設定
- ドラッグ&ドロップ、ズーム&パン

**相関図:**
- SVGキャンバス + ノード・エッジ・グループ
- 複数相関図管理
- 登場人物からのノード自動生成
- タグフィルタリング
- 自動レイアウト（円形・格子・ツリー・力学モデル）

---

## 8. 実装上の注意事項

### SQLite初期化

アプリ起動時、Rust側で以下のPRAGMAを必ず設定する。

```sql
PRAGMA journal_mode=WAL;   -- 並行書き込み（自動保存と校正の同時実行）を安全に処理
PRAGMA foreign_keys=ON;    -- 外部キー制約を有効化
```

### タグの孤立行防止

`tags`テーブルはポリモーフィック設計のため`entity_id`に外部キー制約を付けられない。
エンティティ（characters, glossary等）削除時のRustコマンドで、必ず対応するタグ行を明示的に削除すること。

### APIキー管理の実装

`keyring`クレートを使用してWindows Credential Managerに保存する。
`tauri-plugin-stronghold`も選択肢として検討すること。

### Tiptap縦書きの動作確認

`writing-mode: vertical-rl`はProseMirrorの座標計算と干渉する既知の問題がある。
Phase 1の早い段階でスパイクとして縦書きモードの動作確認を行い、問題があれば代替実装（CSSプロパティの組み合わせ等）を検討する。

### 右パネルのレイアウト予約

Phase 1では右パネルはプレースホルダーだが、`WorkspaceBody`は当初から3カラム構成として右パネルの幅を0に設定して隠す実装にする（Phase 4での追加時のリファクタコストを下げるため）。

### レガシーJSONインポートのスコープ

`import_legacy_json`（現行HTML版からの移行）はPhase 1の完了定義から外し、独立したタスクとして扱う。旧スキーマの変換レイヤーが想定外に複雑になるリスクを切り離す。

---

## 9. フロント ↔ バックエンド通信設計

```
[React]  → invoke('command_name', args)  → [Rust Command] → [SQLite]
[Rust]   → emit('event_name', payload)   → [React]  （リアルタイム通知）
```

| 用途 | 方法 |
|---|---|
| CRUD操作 | `invoke()` でRustコマンドを同期的に呼ぶ |
| 自動保存完了通知 | Rust → `emit('autosave_done')` → React |
| AI応答ストリーミング | Rust → `emit('ai_chunk', {text})` → React |
| 校正結果通知 | Rust → `emit('proofread_result', issues)` → React |

---

## 10. 配布・インストール

- **形式:** NSIS インストーラー（Tauri標準出力）
- **対象OS:** Windows 10/11（64bit）
- **自動更新:** Phase 1では対象外。将来的に `tauri-plugin-updater` で対応を検討
- **データ保存先:** `%APPDATA%\StoryAttic\` （Tauriデフォルト）

---

## 11. 機能優先度サマリー

| 優先度 | 機能群 | 対応フェーズ |
|---|---|---|
| 高 | エディタ基盤（テキスト編集・縦書き・ルビ・傍点・検索置換） | Phase 1 |
| 高 | ファイル管理（プロジェクト・話・章・SQLite保存） | Phase 1 |
| 高 | インポート / エクスポート（JSON・テキスト・ZIP） | Phase 1 |
| 高 | 文章分析 / 校正 | Phase 2 |
| 中 | AI連携（LLM API・クイックアクション） | Phase 3 |
| 中 | 演出・サウンド・キャラウィジェット（癒し機能） | Phase 3 |
| 中 | プロット & タイムライン | Phase 4 |
| 中 | キャラクター管理 | Phase 4 |
| 中 | 用語集 / メモ / 資料 | Phase 4 |
| 低 | 執筆支援（目標・タイマー・日記・履歴） | Phase 4 |
| 低 | マインドマップ | Phase 5 |
| 低 | 相関図 | Phase 5 |

> **注記:** 「癒し」「ユーザーへの寄り添い」はこのアプリのコアバリュー。AI連携・キャラウィジェット・雨の演出は優先度「中」ながら、Phase 3でまとめて実装し機能を充実させる。

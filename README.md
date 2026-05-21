# StoryAttic — 小説家のための統合執筆ツール

> 屋根裏の書斎。あなたの物語を、ひとつの場所で。

StoryAttic は、日本語小説の執筆に特化した Windows 向けネイティブデスクトップアプリです。
プロジェクト管理・リッチテキストエディタ・AI連携・キャラクター管理など、
創作に必要なすべてをひとつのアプリに統合します。

---

## 主な機能

### エディタ
- **Tiptap エディタ** — ProseMirror ベースのリッチテキスト編集
- ルビ・傍点・自動字下げなど日本語小説向け記法
- 縦書き / 横書き切り替え
- デュアルビュー・プレビュー・台詞ビュー
- 検索・置換（正規表現対応）

### プロジェクト管理
- 複数作品をカード形式で一覧管理
- 章ツリー + エピソード構造（ドラッグ&ドロップで並び替え）
- SQLite による安定したローカル保存（`%APPDATA%\StoryAttic\`）

### 執筆支援
- キャラクター管理（タグ・関係図）
- 用語集・資料・メモ・あらすじ
- プロット・タイムライン
- 執筆目標・タイマー・執筆日記

### AI パートナー
- OpenAI / Anthropic / Google Gemini / xAI 対応
- APIキーは Windows Credential Manager で安全に保管
- 執筆補助・推敲・アイデア出しに活用

### 演出機能
- パーティクルエフェクト（雨など）
- キャラクターウィジェット表示

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | React 19 + TypeScript 5.7 + Vite 6 |
| スタイル | Tailwind CSS 3.4 |
| 状態管理 | Zustand 5 |
| エディタ | Tiptap 2 (ProseMirror) |
| バックエンド | Rust + Tauri v2 |
| データベース | SQLite (rusqlite) |
| パッケージ管理 | pnpm |

---

## 動作環境

- **OS**: Windows 10 / 11 (64-bit)
- **Rust**: 1.77 以上
- **Node.js**: 18 以上
- **pnpm**: 9 以上

---

## セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/bookendless/story-attic.git
cd story-attic

# 依存パッケージをインストール
pnpm install

# 開発サーバーを起動（Tauri + Vite）
pnpm tauri dev
```

### ビルド（リリース用インストーラー）

```bash
pnpm tauri build
```

ビルド成果物は `src-tauri/target/release/bundle/` に生成されます。

---

## 開発コマンド

| コマンド | 内容 |
|---|---|
| `pnpm tauri dev` | 開発サーバー起動 |
| `pnpm build` | フロントエンドビルド |
| `pnpm lint` | ESLint 実行 |
| `pnpm test` | Vitest 実行 |
| `npx tsc --noEmit` | TypeScript 型チェック |
| `cargo check` | Rust コンパイルチェック（`src-tauri/` 内） |
| `cargo clippy` | Rust Lint（`src-tauri/` 内） |

---

## ディレクトリ構成

```
story-attic/
├── src/                    # React フロントエンド
│   ├── app/                # ルートコンポーネント・ルーティング
│   ├── components/         # 共通 UI コンポーネント
│   ├── features/           # 機能別モジュール
│   │   ├── editor/         # Tiptap エディタ
│   │   ├── project/        # プロジェクト管理
│   │   ├── chapters/       # 章管理
│   │   ├── characters/     # キャラクター管理
│   │   ├── ai/             # AI 連携
│   │   ├── ambience/       # 演出機能
│   │   └── ...             # その他支援機能
│   └── shared/             # 型定義・ユーティリティ・ストア
└── src-tauri/              # Rust バックエンド
    ├── src/
    │   ├── commands/       # Tauri コマンドハンドラ
    │   ├── db/             # SQLite マイグレーション
    │   └── models/         # データモデル
    └── tauri.conf.json

```

---

## キーボードショートカット

| ショートカット | 機能 |
|---|---|
| `Ctrl+S` | 保存 |
| `Ctrl+F` | 検索・置換 |
| `Ctrl+Shift+A` | AI パネル開閉 |
| `Ctrl+Shift+D` | デュアルビュー切り替え |
| `Ctrl+Shift+P` | プレビュー切り替え |
| `Ctrl+Shift+L` | 台詞ビュー切り替え |

---

## ライセンス

[MIT License](LICENSE)

Copyright (c) 2026 bookendless

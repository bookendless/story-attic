# story-attic — プロジェクト固有ガイドライン

## スタック
- **フロントエンド**: React + TypeScript + Vite + Tailwind CSS
- **バックエンド**: Rust (Tauri v2, src-tauri/)
- **パッケージマネージャー**: pnpm

## 開発コマンド
| 目的 | コマンド |
|------|---------|
| 開発サーバー起動 | `pnpm tauri dev` |
| フロントエンドビルド | `pnpm build` |
| フロントエンド Lint | `pnpm lint` |
| TypeScript チェック | `npx tsc --noEmit` |
| Rust チェック | `cargo check` (src-tauri/ 内) |
| Rust Lint | `cargo clippy` (src-tauri/ 内) |

## 修正・実装後の確認手順
1. フロントエンドを変更した場合: `pnpm lint` → PASS を確認
2. Rust を変更した場合: `cargo clippy` → warning/error なしを確認
3. 両方を変更した場合: 両方実行

## ディレクトリ構成
- `src/` — React コンポーネント・ロジック
- `src-tauri/` — Rust バックエンド（Tauri コマンド・状態管理）
- `src/components/` — UI コンポーネント
- `plans/`, `specs/` — 設計ドキュメント（変更前に参照）

## 注意事項
- `.env` ファイルは gitignore 済み。APIキー等は絶対にコードにハードコードしない。
- `node_modules/`, `dist/`, `src-tauri/target/` はコミット対象外。

import { useMemo } from 'react';
import { sanitizeHtml } from '@/shared/utils/sanitizeHtml';
import { useEditorStore } from '@/shared/stores/editorStore';
import { useUIStore, type PreviewSubMode } from '@/shared/stores/uiStore';

/** HTMLタグを除去してプレーンテキストを返す（ブロック要素は改行に変換） */
function stripHtml(html: string): string {
  const withBreaks = html
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n');
  const div = document.createElement('div');
  div.innerHTML = withBreaks;
  return (div.textContent ?? '').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
}

const MANUSCRIPT_MAX_PAGES = 10;

/**
 * テキストを原稿用紙のページ配列へ整形する。
 * - 段落（\n 区切り）ごとに新しい列（行）から開始
 * - 空段落は空の列 1 本として描画（場面区切りの空行を保持）
 * 各ページは charsPerLine × linesPerPage のセルを列優先で埋めたフラット配列。
 */
function layoutManuscript(text: string, charsPerLine: number, linesPerPage: number): string[][] {
  const charsPerPage = charsPerLine * linesPerPage;
  const pages: string[][] = [];
  let page: string[] = [];

  const pushCell = (ch: string) => {
    page.push(ch);
    if (page.length >= charsPerPage) {
      pages.push(page);
      page = [];
    }
  };
  // 現在の列の残りを空セルで埋め、次の列の先頭へ移動する
  const endColumn = () => {
    const rem = page.length % charsPerLine;
    if (rem !== 0) {
      for (let i = 0; i < charsPerLine - rem; i++) pushCell('');
    }
  };

  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    if (para.length === 0) {
      // 空段落 = 空の列を 1 本挿入
      endColumn();
      for (let i = 0; i < charsPerLine; i++) pushCell('');
      continue;
    }
    for (const ch of para) pushCell(ch);
    endColumn();
  }

  if (page.length > 0) pages.push(page);
  if (pages.length === 0) pages.push([]);
  return pages;
}

interface ManuscriptPreviewProps {
  pages: string[][];
  /** 1行の文字数（縦書きでは1列に並ぶ文字数 = 行の高さ） */
  charsPerLine: number;
  /** 1ページの行数（縦書きでは列数） */
  linesPerPage: number;
}

function ManuscriptPreview({ pages, charsPerLine, linesPerPage }: ManuscriptPreviewProps) {
  const charsPerPage = charsPerLine * linesPerPage;
  // 列数に応じてセルサイズを調整（最小14px・最大24px）
  const cellSize = Math.min(24, Math.max(14, Math.floor(480 / linesPerPage)));
  const totalPages = pages.length;
  const visiblePages = pages.slice(0, MANUSCRIPT_MAX_PAGES);

  return (
    <div className="manuscript-preview-container overflow-auto p-4">
      {visiblePages.map((pageChars, pageIdx) => (
        <div key={pageIdx} className="manuscript-page mb-6">
          {/* ページ番号 */}
          <div
            className="text-xs text-right mb-1 pr-2"
            style={{ color: 'var(--text-muted)' }}
          >
            {pageIdx + 1} / {totalPages}ページ
          </div>
          {/* 原稿用紙グリッド */}
          <div
            className="manuscript-grid"
            style={{
              display: 'grid',
              gridTemplateRows: `repeat(${charsPerLine}, 1fr)`,
              gridTemplateColumns: `repeat(${linesPerPage}, 1fr)`,
              writingMode: 'vertical-rl',
              width: 'fit-content',
              margin: '0 auto',
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
            }}
          >
            {Array.from({ length: charsPerPage }, (_, i) => {
              const ch = pageChars[i] ?? '';
              return (
                <div
                  key={i}
                  className="manuscript-cell"
                  style={{
                    width: `${cellSize}px`,
                    height: `${cellSize}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '0.5px solid var(--border)',
                    fontSize: `${Math.max(10, cellSize - 6)}px`,
                    fontFamily: 'var(--font-heading)',
                    color: 'var(--text)',
                  }}
                >
                  {ch}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {totalPages > MANUSCRIPT_MAX_PAGES && (
        <div className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>
          ※ 表示は{MANUSCRIPT_MAX_PAGES}ページまでに制限されています（全{totalPages}ページ）
        </div>
      )}
    </div>
  );
}

/** スマートフォンプレビュー: 375px幅のiPhone風表示 */
function SmartphonePreview({ html }: { html: string }) {
  return (
    <div className="flex justify-center p-4 overflow-auto h-full">
      <div
        className="smartphone-frame"
        style={{
          width: '375px',
          minHeight: '667px',
          background: '#fff',
          borderRadius: '36px',
          border: '3px solid var(--border-light)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {/* ノッチ風ヘッダー */}
        <div
          style={{
            height: '44px',
            background: '#f5f5f5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '120px',
              height: '28px',
              background: '#e0e0e0',
              borderRadius: '14px',
            }}
          />
        </div>
        {/* コンテンツエリア */}
        <div
          className="smartphone-content"
          style={{
            padding: '20px 16px',
            fontFamily: "'Hiragino Sans', 'Noto Sans JP', sans-serif",
            fontSize: '15px',
            lineHeight: 1.8,
            color: '#333',
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 200px)',
          }}
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(html),
          }}
        />
      </div>
    </div>
  );
}

export function PreviewView() {
  const currentEpisode = useEditorStore((s) => s.currentEpisode);
  const { previewSubMode, setPreviewSubMode, settings } = useUIStore();

  const charsPerLine = settings.chars_per_line;
  const linesPerPage = settings.lines_per_page;
  const charsPerPage = charsPerLine * linesPerPage;

  const plainText = useMemo(
    () => stripHtml(currentEpisode?.body ?? ''),
    [currentEpisode?.body],
  );

  // 段落整形済みのページ配列（ヘッダの総枚数と本文のページ番号で共有）
  const manuscriptPages = useMemo(
    () => layoutManuscript(plainText, charsPerLine, linesPerPage),
    [plainText, charsPerLine, linesPerPage],
  );
  const totalManuscriptPages = plainText.length > 0 ? manuscriptPages.length : 0;

  const modes: { key: PreviewSubMode; label: string }[] = [
    { key: 'manuscript', label: '原稿用紙' },
    { key: 'smartphone', label: 'スマートフォン' },
  ];

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* モード切替ヘッダー */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 py-2 border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
      >
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}
        >
          プレビュー
        </span>
        {totalManuscriptPages > 0 && previewSubMode === 'manuscript' && (
          <span
            className="text-xs"
            style={{ color: 'var(--text-muted)' }}
            title={`${charsPerLine}字×${linesPerPage}行（${charsPerPage}字詰め）原稿用紙換算の総枚数`}
          >
            全 {totalManuscriptPages} 枚
          </span>
        )}
        <div className="flex items-center gap-1 ml-auto">
          {modes.map(({ key, label }) => (
            <button
              key={key}
              className="text-xs px-3 py-1 rounded"
              style={{
                background: previewSubMode === key ? 'var(--accent-soft)' : 'transparent',
                color: previewSubMode === key ? 'var(--accent)' : 'var(--text-muted)',
                border: `1px solid ${previewSubMode === key ? 'var(--accent)' : 'var(--border)'}`,
              }}
              onClick={() => setPreviewSubMode(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* プレビュー本体 */}
      <div className="flex-1 overflow-auto">
        {previewSubMode === 'manuscript' ? (
          <ManuscriptPreview pages={manuscriptPages} charsPerLine={charsPerLine} linesPerPage={linesPerPage} />
        ) : (
          <SmartphonePreview html={currentEpisode?.body ?? ''} />
        )}
      </div>
    </div>
  );
}

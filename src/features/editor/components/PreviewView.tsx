import { useMemo } from 'react';
import DOMPurify from 'dompurify';
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

/** 原稿用紙モード: 20×20マスのグリッド表示（縦書き） */
const MANUSCRIPT_COLS = 20;
const MANUSCRIPT_ROWS = 20;
const MANUSCRIPT_CHARS_PER_PAGE = MANUSCRIPT_COLS * MANUSCRIPT_ROWS;
const MANUSCRIPT_MAX_PAGES = 10;

function ManuscriptPreview({ text }: { text: string }) {
  const pages = useMemo(() => {
    const result: string[][] = [];
    let currentPage: string[] = [];
    let cellIndex = 0;

    for (const ch of text) {
      if (result.length >= MANUSCRIPT_MAX_PAGES) break;
      if (cellIndex >= MANUSCRIPT_CHARS_PER_PAGE) {
        result.push(currentPage);
        currentPage = [];
        cellIndex = 0;
      }

      if (ch === '\n') {
        const currentRow = cellIndex % MANUSCRIPT_ROWS;
        if (currentRow !== 0) {
          const padding = MANUSCRIPT_ROWS - currentRow;
          for (let i = 0; i < padding; i++) {
            if (cellIndex >= MANUSCRIPT_CHARS_PER_PAGE) {
              result.push(currentPage);
              currentPage = [];
              cellIndex = 0;
              break;
            }
            currentPage.push('');
            cellIndex++;
          }
        }
      } else {
        currentPage.push(ch);
        cellIndex++;
      }
    }

    if (currentPage.length > 0 && result.length < MANUSCRIPT_MAX_PAGES) {
      result.push(currentPage);
    }
    if (result.length === 0) result.push([]);
    return result;
  }, [text]);

  return (
    <div className="manuscript-preview-container overflow-auto p-4">
      {pages.map((pageChars, pageIdx) => (
        <div key={pageIdx} className="manuscript-page mb-6">
          {/* ページ番号 */}
          <div
            className="text-xs text-right mb-1 pr-2"
            style={{ color: 'var(--text-muted)' }}
          >
            {pageIdx + 1} / {pages.length}ページ
          </div>
          {/* 原稿用紙グリッド */}
          <div
            className="manuscript-grid"
            style={{
              display: 'grid',
              gridTemplateRows: `repeat(${MANUSCRIPT_ROWS}, 1fr)`,
              gridTemplateColumns: `repeat(${MANUSCRIPT_COLS}, 1fr)`,
              writingMode: 'vertical-rl',
              width: 'fit-content',
              margin: '0 auto',
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
            }}
          >
            {Array.from({ length: MANUSCRIPT_CHARS_PER_PAGE }, (_, i) => {
              const ch = pageChars[i] ?? '';
              return (
                <div
                  key={i}
                  className="manuscript-cell"
                  style={{
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '0.5px solid var(--border)',
                    fontSize: '14px',
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
      {text.length > MANUSCRIPT_MAX_PAGES * MANUSCRIPT_CHARS_PER_PAGE && (
        <div className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>
          ※ 表示は{MANUSCRIPT_MAX_PAGES}ページまでに制限されています
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
            __html: DOMPurify.sanitize(html, {
              USE_PROFILES: { html: true },
              FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form', 'script', 'base', 'link'],
              FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onfocus', 'onblur'],
            }),
          }}
        />
      </div>
    </div>
  );
}

export function PreviewView() {
  const currentEpisode = useEditorStore((s) => s.currentEpisode);
  const { previewSubMode, setPreviewSubMode } = useUIStore();

  const plainText = useMemo(
    () => stripHtml(currentEpisode?.body ?? ''),
    [currentEpisode?.body],
  );

  const totalManuscriptPages = useMemo(() => {
    const charCount = [...plainText].filter((ch) => ch !== '\n').length;
    return charCount > 0 ? Math.ceil(charCount / MANUSCRIPT_CHARS_PER_PAGE) : 0;
  }, [plainText]);

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
            title="400字詰め原稿用紙換算の総枚数"
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
          <ManuscriptPreview text={plainText} />
        ) : (
          <SmartphonePreview html={currentEpisode?.body ?? ''} />
        )}
      </div>
    </div>
  );
}

/**
 * 没入読書モード（ブックビュー）
 *
 * 編集 UI を全て隠した全画面の書籍風ビュー。
 * 章＋エピソードを読み順に連結し、縦書き・ページめくりで通し読みできる。
 *
 * ページ送りの仕組み:
 *   各セクション（章扉 / エピソード本文）を独立した縦書きフローとして扱う。
 *   縦書き(vertical-rl)では行が右→左へ列として並び、列ピッチは line-height に一致する
 *   （.reading-flow で段落マージンを 0 に固定して保証）。表示は
 *   「列ピッチ × 整数」の幅を持つ中央寄せクリップボックスで行い、ページ送りも
 *   列単位（1ページ = colsPerPage 列）で translateX する。これにより
 *   ページ端で行（列）が縦に半分欠けることがない。
 *   最終ページは末尾フラッシュ（shift を cols - colsPerPage に丸め、直前ページと
 *   数列重複させる）。方式は WebView2 上で実測検証済み。
 *   セクションを分けることで各章・各話が必ずページ先頭から始まり、章扉が独立ページになる。
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useUIStore } from '@/shared/stores/uiStore';
import { useAppStore } from '@/shared/stores/appStore';
import { READING_CHARS_PER_MINUTE } from '@/shared/constants/reading';
import { useBookContent, type BookSection } from './useBookContent';
import { loadBookmark, saveBookmark } from './bookmark';
import { matchTcyRuns, wrapTcyHtml } from '@/shared/utils/tateChuYoko';

/** 読了予測（分）。換算レートは分析機能（Rust側）と共有 */
function estimateMinutes(chars: number): number {
  return Math.max(1, Math.ceil(chars / READING_CHARS_PER_MINUTE));
}

/**
 * プレーンテキストを描画し、縦中横対象範囲（数字・略語）を <span class="tcy"> で囲む。
 * 章扉タイトル等の React テキストノード用（本文 HTML は wrapTcyHtml を使う）。
 */
function TcyText({ text, enabled }: { text: string; enabled: boolean }) {
  const ranges = enabled ? matchTcyRuns(text) : [];
  if (ranges.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], i) => {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <span key={i} className="tcy">
        {text.slice(start, end)}
      </span>,
    );
    cursor = end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/** ページ左右の最小余白(px)。ここを除いた幅を列ピッチの整数倍に量子化する */
const MIN_GUTTER = 48;

/** ページ送り連打の抑制間隔(ms)。トラックパッドの慣性スクロール対策 */
const WHEEL_COOLDOWN_MS = 250;

interface ViewportSize {
  w: number;
  h: number;
}

/** 実測結果: 列ピッチ(px)と各セクションの列数（章扉は 0 = 常に1ページ） */
interface Measured {
  pitch: number;
  cols: number[];
}

export function ReadingView() {
  const readingMode = useUIStore((s) => s.readingMode);
  const closeReadingMode = useUIStore((s) => s.closeReadingMode);
  const settings = useUIStore((s) => s.settings);
  const projectId = useAppStore((s) => s.currentProjectId);

  const { sections, loading, totalChars } = useBookContent(readingMode, projectId);

  const viewportRef = useRef<HTMLDivElement>(null);
  const measurerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ViewportSize>({ w: 0, h: 0 });
  const [measured, setMeasured] = useState<Measured>({ pitch: 0, cols: [] });
  const [globalPage, setGlobalPage] = useState(0);
  const restoredRef = useRef(false);
  const lastWheelAtRef = useRef(0);

  const font = settings.editor_font || '游明朝';
  const fontSize = settings.editor_font_size || 18;
  const tcyOn = settings.vertical_tcy;

  // エピソード本文HTMLを縦中横変換した Map（episodeId -> html）。
  // 測定と表示の両方でこの Map を参照し、両者の HTML を必ず一致させる
  // （text-combine-upright はインライン方向に短縮され列数に影響しうるため）。
  // 再フェッチせず、トグルや本文更新時のみ再計算する。
  const htmlByEpisode = useMemo(() => {
    const map = new Map<string, string>();
    for (const sec of sections) {
      if (sec.kind === 'episode') {
        map.set(sec.episodeId, tcyOn ? wrapTcyHtml(sec.html) : sec.html);
      }
    }
    return map;
  }, [sections, tcyOn]);

  // 縦書きコンテンツの共通スタイル（測定用と表示用で完全一致させる）
  // 水平パディングは持たない: 列の量子化はクリップボックス幅と MIN_GUTTER で行う
  const contentStyle = useMemo<React.CSSProperties>(
    () => ({
      height: `${size.h}px`,
      boxSizing: 'border-box',
      padding: '32px 0',
      writingMode: 'vertical-rl',
      textOrientation: 'mixed',
      fontFamily: `'${font}', serif`,
      fontSize: `${fontSize}px`,
      // 2.1: 半レディング(0.55em)が rt(0.5em, line-height:1)を吸収し、
      // ルビ行でも line box が膨張せず列ピッチが一定になる下限値（実測）
      lineHeight: 2.1,
      color: 'var(--text)',
    }),
    [size.h, font, fontSize],
  );

  // ビューポートサイズを監視（リサイズ中の連続再測定を防ぐため150msデバウンス）
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    let timer: number | undefined;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(update, 150);
    });
    ro.observe(el);
    return () => {
      window.clearTimeout(timer);
      ro.disconnect();
    };
  }, [readingMode]);

  // 列ピッチと各セクションの列数を実測する（章扉=0列マーカー、本文=幅から算出）
  useLayoutEffect(() => {
    if (!readingMode || sections.length === 0 || size.w === 0 || size.h === 0) {
      setMeasured({ pitch: 0, cols: [] });
      return;
    }
    const measurer = measurerRef.current;
    if (!measurer) return;
    // 列ピッチ = 使用値の line-height（.reading-flow が段落マージンを0に固定している前提）
    const lh = parseFloat(getComputedStyle(measurer).lineHeight);
    const pitch = Number.isFinite(lh) && lh > 0 ? lh : fontSize * 2.1;
    const cols = sections.map((sec) => {
      if (sec.kind === 'cover') return 0;
      measurer.innerHTML = htmlByEpisode.get(sec.episodeId) ?? sec.html;
      return Math.max(1, Math.round(measurer.scrollWidth / pitch));
    });
    measurer.innerHTML = '';
    setMeasured({ pitch, cols });
  }, [readingMode, sections, htmlByEpisode, size.w, size.h, font, fontSize]);

  // 1ページあたりの列数と、クリップボックス幅（列ピッチの整数倍）
  const colsPerPage = useMemo(() => {
    if (measured.pitch <= 0 || size.w <= MIN_GUTTER * 2) return 0;
    return Math.max(1, Math.floor((size.w - MIN_GUTTER * 2) / measured.pitch));
  }, [measured.pitch, size.w]);
  const clipW = colsPerPage * measured.pitch;

  // ページ開始インデックス（累積）と総ページ数
  const { pageStarts, totalPages } = useMemo(() => {
    const starts: number[] = [];
    let acc = 0;
    if (colsPerPage > 0) {
      for (const c of measured.cols) {
        starts.push(acc);
        acc += c === 0 ? 1 : Math.max(1, Math.ceil(c / colsPerPage));
      }
    }
    return { pageStarts: starts, totalPages: acc };
  }, [measured.cols, colsPerPage]);

  // globalPage から現在のセクションとローカルページを導出
  const { sectionIndex, localPage } = useMemo(() => {
    if (pageStarts.length === 0) return { sectionIndex: 0, localPage: 0 };
    let idx = 0;
    for (let i = 0; i < pageStarts.length; i++) {
      if (globalPage >= pageStarts[i]) idx = i;
      else break;
    }
    return { sectionIndex: idx, localPage: globalPage - pageStarts[idx] };
  }, [globalPage, pageStarts]);

  // しおり復元（開くたびに一度だけ）
  useEffect(() => {
    if (!readingMode) {
      restoredRef.current = false;
      setGlobalPage(0);
      return;
    }
    if (restoredRef.current || totalPages === 0 || !projectId) return;
    restoredRef.current = true;
    const bm = loadBookmark(projectId);
    if (!bm) return;
    const targetIdx = sections.findIndex(
      (s) =>
        (s.kind === 'episode' && s.episodeId === bm.episodeId) ||
        (s.kind === 'cover' && s.firstEpisodeId === bm.episodeId),
    );
    if (targetIdx >= 0 && pageStarts[targetIdx] !== undefined) {
      setGlobalPage(pageStarts[targetIdx]);
    }
  }, [readingMode, totalPages, projectId, sections, pageStarts]);

  // セクションが変わったらしおりを保存（現在セクションのエピソード基準）
  // 復元が終わるまでは保存しない: 開いた直後は sectionIndex=0 のため、
  // 復元より先に保存が走ると先頭セクションでしおりを上書きしてしまう
  useEffect(() => {
    if (!readingMode || !projectId || sections.length === 0) return;
    if (!restoredRef.current) return;
    const sec = sections[sectionIndex];
    if (!sec) return;
    const episodeId = sec.kind === 'episode' ? sec.episodeId : sec.firstEpisodeId;
    if (episodeId) saveBookmark({ projectId, episodeId });
  }, [readingMode, projectId, sections, sectionIndex]);

  // totalPages 変化時に範囲外を丸める
  useEffect(() => {
    if (totalPages > 0 && globalPage > totalPages - 1) {
      setGlobalPage(totalPages - 1);
    }
  }, [totalPages, globalPage]);

  // ページ未確定（totalPages=0）の間は移動しない: -1 等の負ページ状態を作らない
  const goNext = useCallback(() => {
    setGlobalPage((p) => (totalPages <= 0 ? p : Math.min(totalPages - 1, p + 1)));
  }, [totalPages]);
  const goPrev = useCallback(() => {
    setGlobalPage((p) => Math.max(0, p - 1));
  }, []);

  // キーボード操作（縦書き: 左=次へ進む / 右=前へ戻る）
  // 処理したキーは stopPropagation で WorkspacePage のグローバルショートカットに
  // 渡さない（特に Escape: 渡すと同じキー1回で下層のパネル/モーダルまで閉じてしまう）
  useEffect(() => {
    if (!readingMode) return;
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          closeReadingMode();
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          e.stopPropagation();
          goNext();
          break;
        case 'ArrowRight':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          e.stopPropagation();
          goPrev();
          break;
        case 'Home':
          e.preventDefault();
          e.stopPropagation();
          setGlobalPage(0);
          break;
        case 'End':
          e.preventDefault();
          e.stopPropagation();
          setGlobalPage(Math.max(0, totalPages - 1));
          break;
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [readingMode, goNext, goPrev, closeReadingMode, totalPages]);

  // ホイール操作（慣性スクロールで一気に飛ばないようクールダウンを設ける）
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (Math.abs(e.deltaY) < 8 && Math.abs(e.deltaX) < 8) return;
      const now = performance.now();
      if (now - lastWheelAtRef.current < WHEEL_COOLDOWN_MS) return;
      lastWheelAtRef.current = now;
      if (e.deltaY > 0 || e.deltaX > 0) goNext();
      else goPrev();
    },
    [goNext, goPrev],
  );

  if (!readingMode) return null;

  const currentSection: BookSection | undefined = sections[sectionIndex];
  const readingMinutes = estimateMinutes(totalChars);
  const progress = totalPages > 0 ? (globalPage + 1) / totalPages : 0;

  const currentTitle =
    currentSection?.kind === 'cover'
      ? currentSection.title
      : currentSection?.kind === 'episode'
        ? currentSection.title
        : '';

  // 現在セクションの移動量（列単位）。最終ページは末尾フラッシュに丸める
  const currentCols = measured.cols[sectionIndex] ?? 0;
  const shift =
    colsPerPage > 0 && currentCols > colsPerPage
      ? Math.min(localPage * colsPerPage, currentCols - colsPerPage) * measured.pitch
      : 0;

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: 'var(--bg)', zIndex: 300 }}
    >
      {/* 上部バー */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-5 py-2.5 border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
      >
        <span
          className="text-sm font-medium truncate"
          style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)', maxWidth: '40%' }}
          title={currentTitle}
        >
          {currentTitle || '読書モード'}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          読了目安 約{readingMinutes}分・全{totalChars.toLocaleString()}字
        </span>
        <button
          className="ml-auto text-xs px-3 py-1 rounded"
          style={{ color: 'var(--text-mid)', border: '1px solid var(--border)' }}
          onClick={closeReadingMode}
          title="読書モードを閉じる (Esc)"
        >
          閉じる ✕
        </button>
      </div>

      {/* 本文エリア */}
      <div
        ref={viewportRef}
        className="relative flex-1 overflow-hidden"
        onWheel={onWheel}
      >
        {loading && (
          <div
            className="absolute inset-0 flex items-center justify-center text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            本文を読み込んでいます…
          </div>
        )}

        {!loading && sections.length === 0 && (
          <div
            className="absolute inset-0 flex items-center justify-center text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            読む本文がありません。エピソードを作成してください。
          </div>
        )}

        {/* 章扉 */}
        {!loading && currentSection?.kind === 'cover' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="reading-cover flex flex-col items-center gap-6 px-8 text-center"
              style={{ writingMode: 'vertical-rl', maxHeight: '80%' }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: `${Math.round(fontSize * 1.9)}px`,
                  letterSpacing: '0.15em',
                  color: 'var(--text)',
                }}
              >
                <TcyText text={currentSection.title || '無題の章'} enabled={tcyOn} />
              </div>
              {currentSection.mood && (
                <div style={{ fontSize: `${fontSize}px`, color: 'var(--text-mid)', letterSpacing: '0.1em' }}>
                  <TcyText text={currentSection.mood} enabled={tcyOn} />
                </div>
              )}
              {currentSection.summary && (
                <div
                  style={{
                    fontSize: `${Math.round(fontSize * 0.85)}px`,
                    color: 'var(--text-muted)',
                    maxHeight: '60%',
                    lineHeight: 1.9,
                  }}
                >
                  <TcyText text={currentSection.summary} enabled={tcyOn} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* エピソード本文（縦書きページめくり・列ピッチ整数倍のクリップボックス内で描画） */}
        {!loading && currentSection?.kind === 'episode' && clipW > 0 && (
          <div className="absolute inset-0 flex justify-center">
            <div
              style={{
                position: 'relative',
                width: `${clipW}px`,
                height: '100%',
                overflow: 'hidden',
              }}
            >
              <div
                key={currentSection.episodeId}
                className="reading-flow"
                style={{
                  ...contentStyle,
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  transform: `translateX(${shift}px)`,
                  transition: 'transform 280ms ease',
                }}
                dangerouslySetInnerHTML={{
                  __html: htmlByEpisode.get(currentSection.episodeId) ?? currentSection.html,
                }}
              />
            </div>
          </div>
        )}

        {/* ページ送りのタップゾーン（左=次へ / 右=前へ） */}
        {!loading && totalPages > 0 && (
          <>
            <button
              aria-label="次のページ"
              onClick={goNext}
              className="absolute inset-y-0 left-0"
              style={{ width: '28%', background: 'transparent', border: 'none', cursor: 'w-resize' }}
            />
            <button
              aria-label="前のページ"
              onClick={goPrev}
              className="absolute inset-y-0 right-0"
              style={{ width: '28%', background: 'transparent', border: 'none', cursor: 'e-resize' }}
            />
          </>
        )}

        {/* 測定用（不可視・オフスクリーン。表示フローとスタイルを完全一致させる） */}
        <div
          ref={measurerRef}
          aria-hidden
          className="reading-flow"
          style={{
            ...contentStyle,
            position: 'fixed',
            left: '-99999px',
            top: 0,
            visibility: 'hidden',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* 下部バー: 進捗 */}
      <div
        className="flex-shrink-0 px-5 py-2 border-t"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
      >
        <div className="flex items-center gap-3">
          {/* 縦書きは右→左へ読み進むため、次へ=左 / 前へ=右（タップゾーン・キー操作と整合） */}
          <button
            className="text-xs px-2 py-0.5 rounded"
            style={{ color: 'var(--text-mid)', border: '1px solid var(--border)' }}
            onClick={goNext}
            disabled={globalPage >= totalPages - 1}
          >
            ← 次へ
          </button>
          <div
            className="flex-1 h-1.5 rounded-full overflow-hidden"
            style={{ background: 'var(--border)' }}
          >
            {/* 読み進む向き（右→左）に合わせ、充填は右端起点で左へ伸ばす */}
            <div
              style={{
                width: `${Math.round(progress * 100)}%`,
                height: '100%',
                marginLeft: 'auto',
                background: 'var(--accent)',
                transition: 'width 200ms ease',
              }}
            />
          </div>
          <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)', minWidth: '84px', textAlign: 'center' }}>
            {totalPages > 0 ? `${globalPage + 1} / ${totalPages}` : '—'}
          </span>
          <button
            className="text-xs px-2 py-0.5 rounded"
            style={{ color: 'var(--text-mid)', border: '1px solid var(--border)' }}
            onClick={goPrev}
            disabled={globalPage <= 0}
          >
            前へ →
          </button>
        </div>
      </div>
    </div>
  );
}

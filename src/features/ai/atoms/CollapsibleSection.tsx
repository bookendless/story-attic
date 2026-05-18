/**
 * CollapsibleSection — アコーディオン式セクション
 *
 * 開: chevron 下向き + 子要素を表示
 * 閉: chevron 右向き + コンパクトなサマリーを表示し、子要素は DOM ごと削除
 * forceCollapsed: 外部から強制的に閉じる（AI ストリーミング中の自動圧縮）。
 *   見た目だけ閉じ、ユーザーの開閉状態（localStorage）は上書きしない。
 *
 * Plan B のチャット欄スペース確保の心臓部。
 */
import { useId, useState, type ReactNode } from 'react';
import { loadSectionOpen, saveSectionOpen } from '../sectionPersistence';

interface CollapsibleSectionProps {
  title: string;
  /** 開いている時の右端補足 */
  hint?: string;
  /** 閉じている時の右端要約 */
  summary?: ReactNode;
  defaultOpen?: boolean;
  /** フェーズアクセントカラー */
  accent?: string;
  /** 状態ドット（中身に値がある時） */
  hasDot?: boolean;
  /** 渡すと localStorage で開閉状態を永続化（命名: `{phase}-{name}`） */
  storageKey?: string;
  /** 外部から強制的に閉じる（AI 応答中の自動圧縮） */
  forceCollapsed?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({
  title, hint, summary, defaultOpen = false, accent, hasDot,
  storageKey, forceCollapsed, children,
}: CollapsibleSectionProps) {
  const regionId = useId();
  const [open, setOpen] = useState<boolean>(() =>
    storageKey ? loadSectionOpen(storageKey, defaultOpen) : defaultOpen,
  );

  // forceCollapsed が true の間は閉じた見た目だが、ユーザーの設定（open）は保持
  const effectiveOpen = forceCollapsed ? false : open;

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (storageKey) saveSectionOpen(storageKey, next);
      return next;
    });
  };

  return (
    <section
      style={{
        borderRadius: 7,
        transition: 'background 160ms, opacity 160ms',
        opacity: forceCollapsed ? 0.7 : 1,
      }}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={forceCollapsed}
        aria-expanded={effectiveOpen}
        aria-controls={regionId}
        title={forceCollapsed ? 'AI 応答中は折りたたまれています' : undefined}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: effectiveOpen ? '4px 4px 8px' : '6px 6px',
          background: effectiveOpen ? 'transparent' : 'var(--bg-surface)',
          border: '1px solid',
          borderColor: effectiveOpen ? 'transparent' : 'var(--border)',
          borderRadius: 6,
          cursor: forceCollapsed ? 'default' : 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
          transition: 'all 160ms',
        }}
        onMouseEnter={(e) => {
          if (!effectiveOpen && !forceCollapsed) e.currentTarget.style.borderColor = 'var(--border-light)';
        }}
        onMouseLeave={(e) => {
          if (!effectiveOpen) e.currentTarget.style.borderColor = 'var(--border)';
        }}
      >
        {/* Chevron */}
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            width: 12,
            height: 12,
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            transform: effectiveOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 200ms ease',
            fontSize: 9,
            flexShrink: 0,
          }}
        >
          ▶
        </span>

        {/* Title */}
        <span
          style={{
            fontSize: 11,
            color: effectiveOpen ? 'var(--text-mid)' : 'var(--text)',
            fontWeight: 600,
            fontFamily: 'var(--font-heading)',
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {title}
        </span>

        {/* 状態ドット（中身に値がある時） */}
        {hasDot && (
          <span
            aria-hidden
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: accent || 'var(--accent)',
              boxShadow: `0 0 6px ${accent || 'var(--accent)'}`,
              flexShrink: 0,
            }}
          />
        )}

        {/* 閉じている時のサマリー */}
        {!effectiveOpen && summary && (
          <span
            style={{
              fontSize: 10.5,
              color: 'var(--text-muted)',
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textAlign: 'right',
            }}
          >
            {summary}
          </span>
        )}

        {/* 開いている時の hint */}
        {effectiveOpen && hint && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              marginLeft: 'auto',
              flexShrink: 0,
            }}
          >
            {hint}
          </span>
        )}
      </button>

      {effectiveOpen && (
        <div id={regionId} role="region" style={{ padding: '0 4px 4px' }}>
          {children}
        </div>
      )}
    </section>
  );
}

/**
 * PhaseRail — 左端 38px の縦アイコン列。4フェーズの常時切替。
 * サイドバー・フローティング両モードで表示する。
 */
import { useAiStore } from '@/shared/stores/aiStore';
import { PHASE_COLORS } from './phaseColors';
import { PHASE_META, PHASE_ORDER } from './phaseMeta';

export function PhaseRail() {
  const phase = useAiStore((s) => s.phase);
  const setPhase = useAiStore((s) => s.setPhase);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '10px 4px',
        background: 'var(--bg-deep)',
        borderRight: '1px solid var(--border)',
        flexShrink: 0,
        width: 38,
        alignItems: 'center',
      }}
    >
      {PHASE_ORDER.map((key) => {
        const isActive = phase === key;
        const color = PHASE_COLORS[key];
        const meta = PHASE_META[key];
        return (
          <button
            key={key}
            type="button"
            title={`${meta.label} — ${meta.tagline}`}
            aria-pressed={isActive}
            onClick={() => setPhase(key)}
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              border: isActive ? `1px solid ${color.accent}` : '1px solid transparent',
              background: isActive ? color.bg : 'transparent',
              color: isActive ? color.accent : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 200ms ease-out',
              position: 'relative',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.color = 'var(--text-mid)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            {meta.icon}
            {isActive && (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: -4,
                  top: 6,
                  bottom: 6,
                  width: 2,
                  background: color.accent,
                  borderRadius: 2,
                  boxShadow: `0 0 6px ${color.accent}`,
                }}
              />
            )}
          </button>
        );
      })}

      {/* divider */}
      <div aria-hidden style={{ height: 1, width: 14, background: 'var(--border)', margin: '6px 0' }} />

      {/* 縦書きラベル */}
      <div
        aria-hidden
        style={{
          writingMode: 'vertical-rl',
          fontSize: 9,
          color: 'var(--text-muted)',
          letterSpacing: '0.15em',
          marginTop: 2,
          fontFamily: 'var(--font-heading)',
        }}
      >
        Creative Loop
      </div>
    </div>
  );
}

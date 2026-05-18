/**
 * PhaseHeader — フェーズに応じて変身するヘッダー
 *
 * 通常時      : 左アクセント縦バー + フェーズ名（明朝・大）+ tagline + アイコン群
 * 執筆-silent : 超ミニマル（呼吸ランプ + 「執筆中」+ アイコン群）
 */
import type { CreativePhase } from '@/shared/types';
import { useAiStore } from '@/shared/stores/aiStore';
import { PHASE_COLORS } from './phaseColors';
import { PHASE_META } from './phaseMeta';
import { IconBtn } from './atoms/IconBtn';
import { Lamp } from './atoms/Lamp';
import type { WriteLevel } from './types';

export interface PhaseHeaderProps {
  phase: CreativePhase;
  pinned: boolean;
  writeLevel: WriteLevel;
  onTogglePin: () => void;
  onManual: () => void;
  onClose: () => void;
  onCycleWriteLevel: (lv: WriteLevel) => void;
}

export function PhaseHeader({
  phase, pinned, writeLevel,
  onTogglePin, onManual, onClose, onCycleWriteLevel,
}: PhaseHeaderProps) {
  const color = PHASE_COLORS[phase];
  const meta = PHASE_META[phase];
  const contextCount = useAiStore((s) => s.contextSources.length);
  const isWrite = phase === 'write';

  // ── 執筆-silent: 超ミニマル ──────────────────────
  if (isWrite && writeLevel === 'silent') {
    return (
      <div
        style={{
          padding: '10px 14px',
          background: color.bg,
          borderBottom: `1px solid ${color.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          transition: 'background 320ms, border-color 320ms',
        }}
      >
        {/* 微かなランプ光 */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '-50%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '140%',
            height: '300%',
            background: `radial-gradient(ellipse at center, ${color.bg} 0%, transparent 50%)`,
            opacity: 0.5,
            pointerEvents: 'none',
            animation: 'lampRadial 6s ease-in-out infinite',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
          <Lamp size={9} accent={color.accent} />
          <span
            style={{
              fontSize: 11,
              color: color.accent,
              fontFamily: 'var(--font-heading)',
              letterSpacing: '0.15em',
            }}
          >
            執筆中
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative' }}>
          <IconBtn title="少しだけ呼び出す" accent={color.accent} onClick={() => onCycleWriteLevel('mini')}>
            ⤴
          </IconBtn>
          <IconBtn
            title={pinned ? 'フローティングに切替' : 'サイドバーに固定'}
            active={pinned}
            accent={color.accent}
            onClick={onTogglePin}
          >
            {pinned ? '📌' : '⊞'}
          </IconBtn>
          <IconBtn title="閉じる" onClick={onClose}>✕</IconBtn>
        </div>
      </div>
    );
  }

  // ── 通常ヘッダー ─────────────────────────────────
  return (
    <div
      style={{
        padding: '12px 14px 11px',
        background: `linear-gradient(180deg, ${color.bg} 0%, transparent 100%)`,
        borderBottom: `1px solid ${color.border}`,
        flexShrink: 0,
        position: 'relative',
        transition: 'background 320ms, border-color 320ms',
      }}
    >
      {/* 左アクセント縦バー */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 12,
          bottom: 12,
          width: 2,
          background: color.accent,
          boxShadow: `0 0 8px ${color.accent}`,
          borderRadius: 2,
        }}
      />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 17,
                fontWeight: 500,
                color: 'var(--text)',
                letterSpacing: '0.06em',
                transition: 'color 320ms',
              }}
            >
              {meta.label}
            </span>
            <span style={{ fontSize: 11, color: color.accent, fontWeight: 500 }}>
              {meta.icon}
            </span>
            {isWrite && writeLevel !== 'silent' && (
              <button
                type="button"
                onClick={() => onCycleWriteLevel(writeLevel === 'mini' ? 'open' : 'silent')}
                title="呼び出しレベルを切替"
                style={{
                  marginLeft: 'auto',
                  fontSize: 9.5,
                  padding: '1px 7px',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {writeLevel === 'mini' ? '展開' : 'しまう'}
              </button>
            )}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
            {meta.tagline}
            {contextCount > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 9,
                  color: color.accent,
                  padding: '0 5px',
                  borderRadius: 999,
                  background: `color-mix(in srgb, ${color.accent} 15%, transparent)`,
                  border: `1px solid ${color.border}`,
                }}
              >
                {contextCount} 件参照中
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <IconBtn title="AI マニュアルを開く" accent={color.accent} onClick={onManual}>?</IconBtn>
          <IconBtn
            title={pinned ? 'フローティングに切替' : 'サイドバーに固定'}
            active={pinned}
            accent={color.accent}
            onClick={onTogglePin}
          >
            {pinned ? '📌' : '⊞'}
          </IconBtn>
          <IconBtn title="閉じる" onClick={onClose}>✕</IconBtn>
        </div>
      </div>
    </div>
  );
}

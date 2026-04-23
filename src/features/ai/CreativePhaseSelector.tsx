/**
 * Creative Loop Engine — フェーズセレクター
 * 創作の現在フェーズを切り替えるUI。フェーズごとに固有のアクセントカラーを持つ。
 */

import { useAiStore } from '@/shared/stores/aiStore';
import type { CreativePhase } from '@/shared/types';
import { PHASE_COLORS } from './phaseColors';

interface PhaseConfig {
  value: CreativePhase;
  label: string;
  icon: string;
  desc: string;
}

const PHASES: PhaseConfig[] = [
  { value: 'explore',   label: '探索', icon: '◎', desc: 'アイデアを自由に広げる段階' },
  { value: 'structure', label: '構造', icon: '⬡', desc: '構成・プロット・伏線を固める段階' },
  { value: 'write',     label: '執筆', icon: '✦', desc: '書くことに集中する段階（AIは見守りモード）' },
  { value: 'revise',    label: '改稿', icon: '↺', desc: '推敲・改善する段階' },
];

export function CreativePhaseSelector() {
  const { phase, setPhase } = useAiStore();

  return (
    <div
      className="flex items-center gap-1 px-3 py-1.5 flex-shrink-0"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <span
        className="text-xs flex-shrink-0 mr-1"
        style={{ color: 'var(--text-muted)', fontSize: '10px' }}
      >
        フェーズ
      </span>
      {PHASES.map((p) => {
        const isActive = phase === p.value;
        const color = PHASE_COLORS[p.value];
        return (
          <button
            key={p.value}
            className="text-xs"
            style={{
              padding: '2px 7px',
              borderRadius: '8px',
              border: isActive ? `1px solid ${color.accent}` : '1px solid var(--border)',
              background: isActive ? color.bg : 'transparent',
              color: isActive ? color.accent : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 150ms',
              whiteSpace: 'nowrap',
              fontWeight: isActive ? 600 : 400,
            }}
            onClick={() => setPhase(p.value)}
            title={p.desc}
          >
            <span style={{ marginRight: '3px', fontSize: '9px' }}>{p.icon}</span>
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

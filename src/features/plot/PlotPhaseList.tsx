/**
 * プロットフェーズ一覧 — ASB 構造タイプに応じた色付きフェーズ表示
 */

import { PLOT_STRUCTURE_PHASES } from '@/shared/constants/asbEnums';
import type { PlotStructureType } from '@/shared/constants/asbEnums';

interface PlotPhaseListProps {
  structureType: string;
  compact?: boolean;
}

export function PlotPhaseList({ structureType, compact = false }: PlotPhaseListProps) {
  const phases = PLOT_STRUCTURE_PHASES[structureType as PlotStructureType];
  if (!phases) {
    return (
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
        構造が未選択です
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {phases.map((p) => (
        <div
          key={p.key}
          className="flex items-start gap-2 rounded px-2 py-1"
          style={{
            borderLeft: `3px solid ${p.color}`,
            background: 'var(--bg-elevated)',
          }}
        >
          <span
            className="inline-block flex-shrink-0 rounded-full"
            style={{
              width: '8px',
              height: '8px',
              marginTop: '4px',
              background: p.color,
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>
              {p.label}
            </div>
            {!compact && (
              <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                {p.description}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

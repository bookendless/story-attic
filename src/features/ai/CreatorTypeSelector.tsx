/**
 * Creator Model Engine — 作家タイプ・口調セレクター
 * Explorer（発想型）/ Architect（設計型）を選択し、プロジェクト単位で永続化する。
 * アクティブ色は現在のフェーズカラーに連動する。
 */

import { useAiStore } from '@/shared/stores/aiStore';
import { useAppStore } from '@/shared/stores/appStore';
import type { CreatorType, AiTone } from '@/shared/types';
import { PHASE_COLORS } from './phaseColors';

const CREATOR_TYPES: { value: CreatorType; label: string; desc: string }[] = [
  { value: 'explorer',  label: 'Explorer',  desc: '発散型：「もし〜なら？」で可能性を広げる' },
  { value: 'architect', label: 'Architect', desc: '構造型：矛盾チェック・プロット分析' },
];

const TONES: { value: AiTone; label: string }[] = [
  { value: 'formal',  label: '丁寧' },
  { value: 'casual',  label: 'カジュアル' },
  { value: 'harsh',   label: '辛口' },
];

export function CreatorTypeSelector() {
  const { creatorType, tone, setTone, saveCreatorType, phase } = useAiStore();
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const color = PHASE_COLORS[phase];

  const handleTypeChange = (type: CreatorType) => {
    if (!currentProjectId) return;
    saveCreatorType(currentProjectId, type);
  };

  const activeStyle = {
    border: `1px solid ${color.accent}`,
    background: color.bg,
    color: color.accent,
    fontWeight: 600,
  };
  const inactiveStyle = {
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontWeight: 400,
  };

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      {/* 作家タイプ選択 */}
      <div className="flex items-center gap-1">
        {CREATOR_TYPES.map((ct) => (
          <button
            key={ct.value}
            className="text-xs"
            style={{
              padding: '2px 7px',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 150ms',
              whiteSpace: 'nowrap',
              ...(creatorType === ct.value ? activeStyle : inactiveStyle),
            }}
            onClick={() => handleTypeChange(ct.value)}
            title={ct.desc}
          >
            {ct.label}
          </button>
        ))}
      </div>

      <span style={{ color: 'var(--border)', fontSize: '10px' }}>|</span>

      {/* 口調選択 */}
      <div className="flex items-center gap-1">
        {TONES.map((t) => (
          <button
            key={t.value}
            className="text-xs"
            style={{
              padding: '2px 7px',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 150ms',
              whiteSpace: 'nowrap',
              ...(tone === t.value ? activeStyle : inactiveStyle),
            }}
            onClick={() => setTone(t.value)}
            title={`口調: ${t.label}`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * StructurePhase — 構造フェーズボディ
 * 主役: 「構造を確かめる」（検証プロンプト、デフォルト開）
 */
import { useAiStore } from '@/shared/stores/aiStore';
import { PHASE_COLORS } from '../phaseColors';
import { CollapsibleSection } from '../atoms/CollapsibleSection';
import { PromptCard } from '../atoms/PromptCard';
import { RefRow } from '../atoms/RefRow';
import { useStructureContext } from '../hooks/useStructureContext';
import { STRUCTURE_PROMPTS } from '../phasePrompts';
import type { PhaseBodyProps } from '../types';
import { CreatorAndTone } from './CreatorAndTone';
import {
  summarizeContext, summarizeCreator, ALL_CONTEXT_SOURCES, CONTEXT_LABELS,
} from './phaseShared';

export function StructurePhase({ chatRef, isStreaming }: PhaseBodyProps) {
  const accent = PHASE_COLORS.structure.accent;
  const creatorType = useAiStore((s) => s.creatorType);
  const tone = useAiStore((s) => s.tone);
  const contextSources = useAiStore((s) => s.contextSources);
  const toggleContextSource = useAiStore((s) => s.toggleContextSource);
  const { episodeTitle, charCount, planted, resolved, total } = useStructureContext();

  const segCount = Math.min(Math.max(total, 1), 10);

  return (
    <div
      style={{
        padding: '10px 12px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        animation: 'phaseEnter 320ms ease-out',
      }}
    >
      <CollapsibleSection
        title="いまの位置"
        accent={accent}
        summary={`${episodeTitle} · 伏線 ${planted}設置/${resolved}回収`}
        storageKey="structure-position"
        forceCollapsed={isStreaming}
      >
        <div
          style={{
            padding: 12,
            background: 'var(--bg-surface)',
            border: `1px solid ${PHASE_COLORS.structure.border}`,
            borderLeft: `2px solid ${accent}`,
            borderRadius: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginTop: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-heading)', fontWeight: 500 }}>
              {episodeTitle}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{charCount.toLocaleString()}字</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)', minWidth: 36 }}>伏線</span>
            {total > 0 ? (
              <div style={{ display: 'flex', gap: 3, flex: 1 }}>
                {Array.from({ length: segCount }, (_, i) => {
                  const r = Math.round((resolved / total) * segCount);
                  const p = Math.round((planted / total) * segCount);
                  return (
                    <span
                      key={i}
                      style={{
                        flex: 1,
                        height: 4,
                        borderRadius: 2,
                        background: i < r
                          ? accent
                          : i < r + p
                            ? `color-mix(in srgb, ${accent} 30%, transparent)`
                            : 'var(--border)',
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)', flex: 1 }}>伏線は未登録</span>
            )}
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{planted} 設置 / {resolved} 回収</span>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="構造を確かめる"
        accent={accent}
        defaultOpen
        storageKey="structure-prompts"
        forceCollapsed={isStreaming}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, paddingTop: 4 }}>
          {STRUCTURE_PROMPTS[creatorType].map((p) => (
            <PromptCard
              key={p.label}
              title={p.label}
              sub={p.sub}
              accent={accent}
              disabled={isStreaming}
              onClick={() => chatRef.current?.insertTemplate(p.prompt)}
            />
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="送る材料"
        accent={accent}
        summary={summarizeContext(contextSources)}
        storageKey="structure-context"
        forceCollapsed={isStreaming}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4 }}>
          {ALL_CONTEXT_SOURCES.map((src) => (
            <RefRow
              key={src}
              label={CONTEXT_LABELS[src]}
              active={contextSources.includes(src)}
              accent={accent}
              onToggle={() => toggleContextSource(src)}
              hint={src === 'foreshadowing' && total > 0 ? `${total}件` : undefined}
            />
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="作家タイプ・口調"
        accent={accent}
        summary={summarizeCreator(creatorType, tone)}
        storageKey="structure-creator"
        forceCollapsed={isStreaming}
      >
        <CreatorAndTone accent={accent} />
      </CollapsibleSection>
    </div>
  );
}

/**
 * RevisePhase — 改稿フェーズボディ
 * 主役: 「読み直しの問い」（評価系プロンプト、デフォルト開）
 */
import { useAiStore } from '@/shared/stores/aiStore';
import type { AiContextSource } from '@/shared/types';
import { PHASE_COLORS } from '../phaseColors';
import { CollapsibleSection } from '../atoms/CollapsibleSection';
import { PromptCard } from '../atoms/PromptCard';
import { RefRow } from '../atoms/RefRow';
import { Metric } from '../atoms/Metric';
import { useRevisionMetrics } from '../hooks/useRevisionMetrics';
import { REVISE_PROMPTS } from '../phasePrompts';
import type { PhaseBodyProps } from '../types';
import { CreatorAndTone } from './CreatorAndTone';
import { summarizeContext, summarizeCreator, CONTEXT_LABELS } from './phaseShared';

/** 改稿で外せない必須ソース */
const LOCKED_SOURCES: AiContextSource[] = ['body', 'synopsis'];
/** 任意で追加できるソース */
const OPTIONAL_SOURCES: AiContextSource[] = ['characters', 'glossary', 'plot', 'worldbuilding', 'foreshadowing'];

export function RevisePhase({ chatRef, isStreaming }: PhaseBodyProps) {
  const accent = PHASE_COLORS.revise.accent;
  const creatorType = useAiStore((s) => s.creatorType);
  const tone = useAiStore((s) => s.tone);
  const contextSources = useAiStore((s) => s.contextSources);
  const toggleContextSource = useAiStore((s) => s.toggleContextSource);
  const { episodeTitle, charCount, readMinutes, variance } = useRevisionMetrics();

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
        title="読み直しメトリクス"
        accent={accent}
        hint={episodeTitle}
        summary={`${charCount.toLocaleString()}字 · 読了${readMinutes}分 · ばらつき${variance}`}
        storageKey="revise-metrics"
        forceCollapsed={isStreaming}
      >
        <div style={{ display: 'flex', gap: 6, paddingTop: 6 }}>
          <Metric label="文字数" value={charCount.toLocaleString()} accent={accent} />
          <Metric label="読了" value={`${readMinutes}分`} hint="平均読速" />
          <Metric
            label="文体ばらつき"
            value={variance}
            accent={variance === '低' ? 'var(--success)' : variance === '高' ? 'var(--warning)' : undefined}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="読み直しの問い"
        accent={accent}
        defaultOpen
        storageKey="revise-prompts"
        forceCollapsed={isStreaming}
      >
        <div style={{ display: 'grid', gap: 6, paddingTop: 4 }}>
          {REVISE_PROMPTS[creatorType].map((p) => (
            <PromptCard
              key={p.label}
              title={p.label}
              sub={p.sub}
              accent={accent}
              large
              disabled={isStreaming}
              onClick={() => chatRef.current?.insertTemplate(p.prompt)}
            />
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="読み比べる材料"
        accent={accent}
        hint="改稿に必要"
        summary={summarizeContext(contextSources)}
        storageKey="revise-context"
        forceCollapsed={isStreaming}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4 }}>
          {LOCKED_SOURCES.map((src) => (
            <RefRow key={src} label={CONTEXT_LABELS[src]} active accent={accent} locked hint="固定" />
          ))}
          {OPTIONAL_SOURCES.map((src) => (
            <RefRow
              key={src}
              label={CONTEXT_LABELS[src]}
              active={contextSources.includes(src)}
              accent={accent}
              onToggle={() => toggleContextSource(src)}
            />
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="作家タイプ・口調"
        accent={accent}
        summary={summarizeCreator(creatorType, tone)}
        storageKey="revise-creator"
        forceCollapsed={isStreaming}
      >
        <CreatorAndTone accent={accent} />
      </CollapsibleSection>
    </div>
  );
}

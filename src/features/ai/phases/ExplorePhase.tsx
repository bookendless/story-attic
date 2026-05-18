/**
 * ExplorePhase — 探索フェーズボディ
 * 主役: 「きょうの問い」（発散プロンプト、デフォルト開）
 */
import { useAiStore } from '@/shared/stores/aiStore';
import { PHASE_COLORS } from '../phaseColors';
import { CollapsibleSection } from '../atoms/CollapsibleSection';
import { CoreField } from '../atoms/CoreField';
import { PromptCard } from '../atoms/PromptCard';
import { Chip } from '../atoms/Chip';
import { useCreativeCore } from '../hooks/useCreativeCore';
import { EXPLORE_PROMPTS } from '../phasePrompts';
import type { PhaseBodyProps } from '../types';
import { CreatorAndTone } from './CreatorAndTone';
import {
  summarizeContext, summarizeCreator, ALL_CONTEXT_SOURCES, CONTEXT_LABELS,
} from './phaseShared';

export function ExplorePhase({ chatRef, isStreaming }: PhaseBodyProps) {
  const accent = PHASE_COLORS.explore.accent;
  const creatorType = useAiStore((s) => s.creatorType);
  const tone = useAiStore((s) => s.tone);
  const contextSources = useAiStore((s) => s.contextSources);
  const toggleContextSource = useAiStore((s) => s.toggleContextSource);
  const { localCore, hasCore, handleFieldChange } = useCreativeCore();

  const coreSummary = localCore.theme || localCore.centralEmotion || '未設定';

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
        title="作品の Core"
        accent={accent}
        hasDot={hasCore}
        hint="重力の中心"
        summary={coreSummary}
        storageKey="explore-core"
        forceCollapsed={isStreaming}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6 }}>
          <CoreField label="テーマ" placeholder="例：赦しと再生" value={localCore.theme}
            onChange={(v) => handleFieldChange('theme', v)} accent={accent} large />
          <CoreField label="中心感情" placeholder="例：静かな希望" value={localCore.centralEmotion}
            onChange={(v) => handleFieldChange('centralEmotion', v)} accent={accent} />
          <CoreField label="作品の問い" placeholder="例：人は過去の自分を赦せるか" value={localCore.coreQuestion}
            onChange={(v) => handleFieldChange('coreQuestion', v)} accent={accent} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="きょうの問い"
        accent={accent}
        defaultOpen
        hint={`${creatorType === 'explorer' ? 'Explorer' : 'Architect'} 向け`}
        storageKey="explore-prompts"
        forceCollapsed={isStreaming}
      >
        <div style={{ display: 'grid', gap: 6, paddingTop: 4 }}>
          {EXPLORE_PROMPTS[creatorType].map((p) => (
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
        title="送る材料"
        accent={accent}
        summary={summarizeContext(contextSources)}
        storageKey="explore-context"
        forceCollapsed={isStreaming}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingTop: 4 }}>
          {ALL_CONTEXT_SOURCES.map((src) => (
            <Chip
              key={src}
              size="sm"
              active={contextSources.includes(src)}
              accent={accent}
              onClick={() => toggleContextSource(src)}
            >
              {CONTEXT_LABELS[src]}
            </Chip>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="作家タイプ・口調"
        accent={accent}
        summary={summarizeCreator(creatorType, tone)}
        storageKey="explore-creator"
        forceCollapsed={isStreaming}
      >
        <CreatorAndTone accent={accent} />
      </CollapsibleSection>
    </div>
  );
}

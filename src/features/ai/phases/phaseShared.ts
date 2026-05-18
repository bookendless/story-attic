/**
 * フェーズボディ共通のヘルパーと定数
 */
import { CONTEXT_LABELS } from '@/shared/stores/aiStore';
import type { AiContextSource, CreatorType, AiTone } from '@/shared/types';

const CT_LABEL: Record<CreatorType, string> = {
  explorer: 'Explorer',
  architect: 'Architect',
};

const TONE_LABEL: Record<AiTone, string> = {
  formal: '丁寧',
  casual: 'カジュアル',
  harsh: '辛口',
};

/** 送る材料の要約 — "本文 · 人物 +1" など */
export function summarizeContext(sources: AiContextSource[]): string {
  if (sources.length === 0) return 'なし';
  const labels = sources.map((s) => CONTEXT_LABELS[s]);
  if (labels.length <= 2) return labels.join(' · ');
  return `${labels.slice(0, 2).join(' · ')} +${labels.length - 2}`;
}

/** 作家タイプ・口調セクションの閉じている時の要約 */
export function summarizeCreator(creatorType: CreatorType, tone: AiTone): string {
  return `${CT_LABEL[creatorType]} · ${TONE_LABEL[tone]}`;
}

/** 全 7 コンテキストソースの並び順 */
export const ALL_CONTEXT_SOURCES: AiContextSource[] = [
  'body', 'characters', 'glossary', 'plot', 'worldbuilding', 'synopsis', 'foreshadowing',
];

export { CONTEXT_LABELS };

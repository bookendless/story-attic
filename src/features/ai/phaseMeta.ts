/**
 * フェーズの表示メタデータ（ラベル・アイコン・tagline）
 * カラーは phaseColors.ts の PHASE_COLORS を参照。
 */
import type { CreativePhase } from '@/shared/types';

export interface PhaseMeta {
  label: string;
  icon: string;
  tagline: string;
}

export const PHASE_META: Record<CreativePhase, PhaseMeta> = {
  explore: { label: '探索', icon: '◎', tagline: 'アイデアを自由に広げる' },
  structure: { label: '構造', icon: '⬡', tagline: '構成・プロット・伏線を固める' },
  write: { label: '執筆', icon: '✦', tagline: '静かに見守ります' },
  revise: { label: '改稿', icon: '↺', tagline: '推敲・改善する' },
};

/** PhaseRail の表示順 */
export const PHASE_ORDER: CreativePhase[] = ['explore', 'structure', 'write', 'revise'];

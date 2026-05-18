/**
 * フェーズ × 作家タイプ別のプリセットプロンプト（旧 AiQuickActions.PHASE_ACTIONS を継承）。
 * sub はカード表示用の短い説明。prompt は AI に送る本文。
 */
import type { CreatorType } from '@/shared/types';

export interface PhasePrompt {
  label: string;
  sub: string;
  prompt: string;
}

/** 探索 / 構造 / 改稿: 作家タイプ別 */
export const EXPLORE_PROMPTS: Record<CreatorType, PhasePrompt[]> = {
  explorer: [
    { label: 'もし〜なら？', sub: '前提を一つ変えて、可能性を3つ広げる', prompt: 'この作品の前提を一つ変えたとしたら、物語はどう動き出しますか？「もし〜なら？」という問いを3つ投げかけてください。' },
    { label: 'テーマ深掘り', sub: 'テーマに潜む対立・矛盾・逆説を問いの形で', prompt: 'このテーマが内包する対立・矛盾・逆説は何ですか？問いの形で返してください。' },
    { label: '意外な視点', sub: '読者の予想を裏切る展開・視点を提示', prompt: '読者の予想を裏切る意外な展開や視点の可能性を、問いの形で提示してください。' },
  ],
  architect: [
    { label: '因果関係チェック', sub: '物語の因果に矛盾がないか問いで検証', prompt: 'この物語の因果関係に矛盾はありますか？問いの形で指摘してください。' },
    { label: 'テーマ一貫性', sub: '設定したテーマが全体で揺れていないか', prompt: '設定したテーマが物語全体で一貫しているか確認するための問いを出してください。' },
  ],
};

export const STRUCTURE_PROMPTS: Record<CreatorType, PhasePrompt[]> = {
  explorer: [
    { label: '場面の順序', sub: '別の並び方を試す', prompt: 'この場面配置は最も効果的ですか？別の並び方で何が変わるか、問いかけてください。' },
    { label: '新しい伏線', sub: '仕掛けの余地を探す', prompt: 'この物語に仕掛けられていない、読者を驚かせる伏線の可能性を問いで提示してください。' },
  ],
  architect: [
    { label: '伏線チェック', sub: '未回収を検出', prompt: '設置した伏線が回収されているか、未回収の伏線がないか確認する問いを出してください。' },
    { label: '矛盾検出', sub: '設定と行動', prompt: 'キャラクター設定と行動の間に論理的矛盾はありますか？問いの形で指摘してください。' },
    { label: '構造分析', sub: '弱点を指摘', prompt: 'このプロット全体の構造的な弱点はどこですか？問いの形で指摘してください。' },
  ],
};

export const REVISE_PROMPTS: Record<CreatorType, PhasePrompt[]> = {
  explorer: [
    { label: 'テーマ適合度', sub: 'Core のテーマ・感情に沿っているか', prompt: 'この場面はCreative Coreのテーマと感情に沿っていますか？問いの形で評価してください。' },
    { label: '読者の感情', sub: 'この場面で読者は何を感じるか', prompt: 'この場面を読んだ読者はどんな感情を持ちますか？問いの形で分析してください。' },
  ],
  architect: [
    { label: '文体一貫性', sub: '文体・視点・口調に揺れはないか', prompt: '文体・視点・口調に揺れはありますか？問題箇所を問いの形で指摘してください。' },
    { label: '感情曲線', sub: 'この章の起伏は適切か', prompt: 'この章の感情の起伏は適切ですか？構造的な観点から問いかけてください。' },
    { label: '整合性確認', sub: '他のシーンと整合しているか', prompt: 'この改稿箇所が他のシーンと整合しているか確認する問いを出してください。' },
  ],
};

/** 執筆フェーズ open モードの「あなたへの問い」（作家タイプ非依存） */
export const WRITE_PROMPTS: PhasePrompt[] = [
  { label: 'この場面が苦しい', sub: '進めない理由を一緒に探す', prompt: 'いま書いている場面で進めなくなっています。書き進められない理由を一緒に探る問いを一つください。' },
  { label: '次の一文に迷う', sub: '可能性の枝を3つ提示', prompt: '次の一文をどう続けるか迷っています。可能性の枝を3つ、問いの形で提示してください。' },
];

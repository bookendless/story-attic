/**
 * AI Creator OS — 動的システムプロンプトビルダー
 *
 * 作家タイプ・創作フェーズ・停滞状態・Creative Coreから
 * リクエストごとにシステムプロンプトを構築する純粋関数。
 */

import type { CreativePhase, CreatorType, BlockType, CreativeCore, AiTone } from '@/shared/types';

export interface CatalystContext {
  phase: CreativePhase;
  creatorType: CreatorType;
  detectedBlock: BlockType;
  creativeCore: CreativeCore;
  tone: AiTone;
  contextData: string;
}

export function buildCatalystPrompt(ctx: CatalystContext): string {
  const sections: string[] = [
    buildRoleSection(),
    buildPrinciplesSection(ctx.phase),
    buildStateSection(ctx),
    buildTypeBehaviorSection(ctx.creatorType),
  ];

  if (ctx.detectedBlock !== 'none') {
    sections.push(buildBlockSection(ctx.detectedBlock));
  }

  sections.push(buildToneSection(ctx.tone));

  if (!ctx.creativeCore.theme && !ctx.creativeCore.centralEmotion && !ctx.creativeCore.coreQuestion) {
    sections.push(
      '# Creative Core未設定\n作品のCoreがまだ定義されていません。テーマ・中心感情・作品の問いを設定すると、より的確な支援ができます。',
    );
  }

  if (ctx.contextData) {
    sections.push(`# 参考情報\n${ctx.contextData}`);
  }

  return sections.join('\n\n');
}

function buildRoleSection(): string {
  return `# Role: 思考パートナー（Catalyst）
あなたは創作者の思考を刺激する思考パートナーです。代わりに書くのではなく、創作者自身が深く考えられるよう支援します。`;
}

function buildPrinciplesSection(phase: CreativePhase): string {
  const silenceRule = phase === 'write'
    ? '- 【執筆フェーズ中】ユーザーが質問しない限り80%は沈黙を守る。自発的な提案・割り込みは行わない'
    : '- ユーザーの問いに誠実に応答し、思考を拡張する支援をする';

  return `# 絶対原則
- 30% AI / 70% Human の原則を守る。創作の主体は人間
- 答えではなく「問い」を返す。直接的な解答・代案の提示は避ける
${silenceRule}
- 代筆・完成した文章の提示は行わない`;
}

function buildStateSection(ctx: CatalystContext): string {
  const typeLabel = ctx.creatorType === 'explorer' ? 'Explorer（発想型）' : 'Architect（設計型）';
  const phaseLabels: Record<CreativePhase, string> = {
    explore: '探索 — アイデアを広げる段階',
    structure: '構造 — 構成・プロットを固める段階',
    write: '執筆 — 書くことに集中する段階',
    revise: '改稿 — 推敲・改善する段階',
  };
  const blockLabel: Record<BlockType, string> = {
    none: 'なし',
    idea: 'アイデア停滞を検知',
    structure: '構造停滞を検知',
    motivation: 'モチベーション停滞を検知',
  };

  const coreTheme = ctx.creativeCore.theme || '未設定';
  const coreEmotion = ctx.creativeCore.centralEmotion || '未設定';
  const coreQuestion = ctx.creativeCore.coreQuestion || '未設定';

  return `# Current State
- Creator Type: ${typeLabel}
- Phase: ${phaseLabels[ctx.phase]}
- Creative Core: テーマ「${coreTheme}」/ 中心感情「${coreEmotion}」/ 作品の問い「${coreQuestion}」
- Detected Block: ${blockLabel[ctx.detectedBlock]}`;
}

function buildTypeBehaviorSection(creatorType: CreatorType): string {
  if (creatorType === 'explorer') {
    return `# Explorer向け支援スタイル
- 「もし〜なら？」という発散的な問いかけを使う
- 正解を求めず、可能性と選択肢を広げる
- 異なる視点・予想外の展開・逆説的な問いを積極的に提示する
- アイデアの評価・採点は行わない`;
  }
  return `# Architect向け支援スタイル
- 矛盾・論理的不整合・設定の一貫性を確認する問いを出す
- 構造的な問題（因果関係・動機・伏線）を指摘する
- 「このシーンの目的は何か」「誰が反対しているか」という構造分析の問いを使う
- 感情より論理・整合性を優先した観点で支援する`;
}

function buildBlockSection(block: Exclude<BlockType, 'none'>): string {
  const blockPrompts: Record<Exclude<BlockType, 'none'>, string> = {
    idea: `# 【アイデア停滞検知】
しばらく入力が止まっています。代わりに書くのではなく、創作者の思考を動かす「問い」を一つだけ投げかけてください。
問いの例: 「このキャラクターが最も恐れているものは何ですか？」「この対立に第三の選択肢があるとしたら？」`,
    structure: `# 【構造停滞検知】
同じ箇所への繰り返し編集が検知されています。構造的な視点から問いを一つ投げかけてください。
問いの例: 「このシーンは物語全体のどのターニングポイントに位置しますか？」「このシーンの目的は何ですか？」`,
    motivation: `# 【モチベーション停滞検知】
執筆リズムの乱れが検知されています。まず創作者の状態を共感的に受け止め、次に「この場面の会話だけ書いてみますか？」のような小さな一歩を促す問いを一つ投げかけてください。`,
  };
  return blockPrompts[block];
}

function buildToneSection(tone: AiTone): string {
  const toneMap: Record<AiTone, string> = {
    formal: '# 口調\n丁寧語で応答してください。',
    casual: '# 口調\nフランクな口調で応答してください。',
    harsh: '# 口調\n遠慮なく率直に指摘してください。ただし「問い」を返すという原則は守ること。',
  };
  return toneMap[tone];
}

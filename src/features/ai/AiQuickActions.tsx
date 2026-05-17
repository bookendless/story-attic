/**
 * AIクイックアクション
 * 創作フェーズ × 作家タイプ別のプリセットプロンプトを提供する。
 * writeフェーズ中はAiPanelから非表示にされる。
 * ホバー色は現在のフェーズカラーに連動する。
 */

import { useAiStore } from '@/shared/stores/aiStore';
import type { CreativePhase, CreatorType } from '@/shared/types';
import type { AiChatHandle } from './AiChat';
import { PHASE_COLORS } from './phaseColors';

interface QuickAction {
  label: string;
  prompt: string;
}

const PHASE_ACTIONS: Record<CreativePhase, Record<CreatorType, QuickAction[]>> = {
  explore: {
    explorer: [
      { label: 'もし〜なら？', prompt: 'この作品の前提を一つ変えたとしたら、物語はどう動き出しますか？「もし〜なら？」という問いを3つ投げかけてください。' },
      { label: 'テーマ深掘り', prompt: 'このテーマが内包する対立・矛盾・逆説は何ですか？問いの形で返してください。' },
      { label: '意外な視点', prompt: '読者の予想を裏切る意外な展開や視点の可能性を、問いの形で提示してください。' },
    ],
    architect: [
      { label: '因果関係チェック', prompt: 'この物語の因果関係に矛盾はありますか？問いの形で指摘してください。' },
      { label: 'テーマ一貫性', prompt: '設定したテーマが物語全体で一貫しているか確認するための問いを出してください。' },
    ],
  },
  structure: {
    explorer: [
      { label: '場面の順序', prompt: 'この場面配置は最も効果的ですか？別の並び方で何が変わるか、問いかけてください。' },
      { label: '新しい伏線', prompt: 'この物語に仕掛けられていない、読者を驚かせる伏線の可能性を問いで提示してください。' },
    ],
    architect: [
      { label: '伏線チェック', prompt: '設置した伏線が回収されているか、未回収の伏線がないか確認する問いを出してください。' },
      { label: '矛盾検出', prompt: 'キャラクター設定と行動の間に論理的矛盾はありますか？問いの形で指摘してください。' },
      { label: '構造分析', prompt: 'このプロット全体の構造的な弱点はどこですか？問いの形で指摘してください。' },
    ],
  },
  write: {
    explorer: [],
    architect: [],
  },
  revise: {
    explorer: [
      { label: 'テーマ適合度', prompt: 'この場面はCreative Coreのテーマと感情に沿っていますか？問いの形で評価してください。' },
      { label: '読者の感情', prompt: 'この場面を読んだ読者はどんな感情を持ちますか？問いの形で分析してください。' },
    ],
    architect: [
      { label: '文体一貫性', prompt: '文体・視点・口調に揺れはありますか？問題箇所を問いの形で指摘してください。' },
      { label: '感情曲線', prompt: 'この章の感情の起伏は適切ですか？構造的な観点から問いかけてください。' },
      { label: '整合性確認', prompt: 'この改稿箇所が他のシーンと整合しているか確認する問いを出してください。' },
    ],
  },
};

interface AiQuickActionsProps {
  chatRef: React.RefObject<AiChatHandle | null>;
}

export function AiQuickActions({ chatRef }: AiQuickActionsProps) {
  const isStreaming = useAiStore((s) => s.isStreaming);
  const phase = useAiStore((s) => s.phase);
  const creatorType = useAiStore((s) => s.creatorType);
  const color = PHASE_COLORS[phase];

  const actions = PHASE_ACTIONS[phase]?.[creatorType] ?? [];

  if (actions.length === 0) return null;

  const handleClick = (action: QuickAction) => {
    if (!chatRef.current) return;
    chatRef.current.insertTemplate(action.prompt);
  };

  return (
    <div
      className="flex flex-wrap gap-1.5 px-3 py-2 flex-shrink-0"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      {actions.map((action) => (
        <button
          key={action.label}
          className="text-xs"
          style={{
            padding: '3px 8px',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text-mid)',
            cursor: isStreaming ? 'not-allowed' : 'pointer',
            opacity: isStreaming ? 0.5 : 1,
            transition: 'background 150ms, color 150ms, border-color 150ms',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            if (!isStreaming) {
              e.currentTarget.style.background = color.bg;
              e.currentTarget.style.color = color.accent;
              e.currentTarget.style.borderColor = color.accent;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg)';
            e.currentTarget.style.color = 'var(--text-mid)';
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
          onClick={() => handleClick(action)}
          disabled={isStreaming}
          title={action.prompt}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

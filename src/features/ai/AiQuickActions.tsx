/**
 * AIクイックアクション
 * プリセットプロンプトをワンクリックで送信する。
 * AiChat の chatRef を通じてメッセージを注入する。
 */

import { useEditorStore } from '@/shared/stores/editorStore';
import { useAiStore } from '@/shared/stores/aiStore';
import type { AiChatHandle } from './AiChat';

/** プリセットアクション定義 */
interface QuickAction {
  label: string;
  /** 送信するプロンプトを生成する関数。本文スニペットは自動付加される */
  prompt: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'この場面を膨らませて', prompt: '以下の場面をより豊かに膨らませてください。情景描写や心理描写を加えてください。' },
  { label: 'キャラの会話を提案', prompt: '以下の場面に合うキャラクター同士の会話を提案してください。キャラの個性が出る口調で書いてください。' },
  { label: '続きを書いて', prompt: '以下の文章の続きを書いてください。文体やトーンを合わせてください。' },
  { label: '要約して', prompt: '以下の文章を簡潔に要約してください。' },
  { label: '表現を言い換え', prompt: '以下の文章をより良い表現に言い換えてください。同じ意味を保ちつつ、文章の質を高めてください。' },
  { label: 'タイトル案を出して', prompt: '以下の内容にふさわしいタイトル案を5つ提案してください。' },
];

/** 本文からコンテキストスニペットを取得する最大文字数 */
const CONTEXT_MAX_CHARS = 1200;

interface AiQuickActionsProps {
  chatRef: React.RefObject<AiChatHandle | null>;
}

export function AiQuickActions({ chatRef }: AiQuickActionsProps) {
  const isStreaming = useAiStore((s) => s.isStreaming);
  const currentEpisode = useEditorStore((s) => s.currentEpisode);

  const handleClick = (action: QuickAction) => {
    if (!chatRef.current) return;

    // エディタ本文の末尾をコンテキストとして付加
    const body = currentEpisode?.body ?? '';
    const snippet = body.length > CONTEXT_MAX_CHARS
      ? '…' + body.slice(-CONTEXT_MAX_CHARS)
      : body;

    const fullPrompt = snippet
      ? `${action.prompt}\n\n---\n${snippet}`
      : action.prompt;

    chatRef.current.sendMessage(fullPrompt);
  };

  return (
    <div
      className="flex flex-wrap gap-1.5 px-3 py-2 flex-shrink-0"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      {QUICK_ACTIONS.map((action) => (
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
            transition: 'background 150ms, color 150ms',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            if (!isStreaming) {
              e.currentTarget.style.background = 'var(--accent)';
              e.currentTarget.style.color = 'var(--bg-deep)';
              e.currentTarget.style.borderColor = 'var(--accent)';
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

/**
 * ChatArea — AI 対話領域の表示部（ヘッダー・メッセージ一覧・入力欄）。
 * 送信・ストリーミングのロジックは AiChat が保持し、本コンポーネントは表示のみ担う。
 */
import type { RefObject, KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from '@/shared/stores/aiStore';
import type { CreativePhase, BlockType } from '@/shared/types';
import { PHASE_COLORS } from './phaseColors';
import type { WriteLevel } from './types';

const HINTS: Record<CreativePhase, string> = {
  explore: '創作の可能性を、問いの形で広げます。\nテーマや漠然としたアイデアを書いてみてください。',
  structure: '構造の弱点・伏線の抜けを問いの形で指摘します。\nプロット全体や場面の並びを書いてみてください。',
  write: '必要なときだけ呼んでください。',
  revise: '読者の目線で原稿を読み直し、改善の問いを返します。\n気になる場面を貼り付けてもOKです。',
};

const PLACEHOLDERS: Record<CreativePhase, string> = {
  explore: 'まだ形にならない発想を書いてみる…',
  structure: '構造についての問いを書く…',
  write: '必要なときだけ — Enter で送信',
  revise: '改稿について相談する…',
};

export interface ChatAreaProps {
  phase: CreativePhase;
  writeLevel: WriteLevel;
  isStreaming: boolean;
  messages: ChatMessage[];
  streamBuffer: string;
  theme: 'dark' | 'light';
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onRetry: () => void;
  onClear: () => void;
  socratesMode: boolean;
  socratesDepth: number;
  onStartSocrates: () => void;
  onResetSocrates: () => void;
  detectedBlock: BlockType;
  onAskBlock: () => void;
  onDismissBlock: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
}

export function ChatArea({
  phase, writeLevel, isStreaming, messages, streamBuffer, theme,
  input, onInputChange, onSend, onKeyDown, onRetry, onClear,
  socratesMode, socratesDepth, onStartSocrates, onResetSocrates,
  detectedBlock, onAskBlock, onDismissBlock,
  textareaRef, messagesEndRef,
}: ChatAreaProps) {
  const accent = PHASE_COLORS[phase].accent;
  const isSilent = phase === 'write' && writeLevel === 'silent';
  const showMessages = !isSilent || messages.length > 0 || isStreaming;
  const canSend = Boolean(input.trim()) && !isStreaming;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        borderTop: isSilent ? 'none' : '1px solid var(--border)',
        background: 'var(--bg)',
      }}
    >
      {/* ヘッダー（silent では非表示） */}
      {!isSilent && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 14px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontSize: 10.5,
                color: 'var(--text-muted)',
                letterSpacing: '0.1em',
                fontWeight: 600,
              }}
            >
              対話
            </span>
            {isStreaming && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 9.5,
                  padding: '1px 7px',
                  borderRadius: 999,
                  background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                  color: accent,
                  fontWeight: 600,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: accent,
                    animation: 'pulseDot 1.1s ease-in-out infinite',
                  }}
                />
                応答中
              </span>
            )}
            {socratesMode ? (
              <button
                type="button"
                onClick={onResetSocrates}
                title="深掘りモードを終了する"
                style={{
                  padding: '1px 7px',
                  fontSize: 10,
                  background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                  color: accent,
                  border: `1px solid ${accent}`,
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                深掘り {socratesDepth}/5 — 終了
              </button>
            ) : (
              <button
                type="button"
                onClick={onStartSocrates}
                disabled={isStreaming}
                title="AIが一問ずつ深掘り質問を返すモード（最大5往復）"
                style={{
                  padding: '1px 7px',
                  fontSize: 10,
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  borderRadius: 999,
                  cursor: isStreaming ? 'not-allowed' : 'pointer',
                  opacity: isStreaming ? 0.4 : 1,
                  fontFamily: 'inherit',
                }}
              >
                深掘り
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClear}
            title="会話履歴をクリア"
            style={{
              fontSize: 10.5,
              color: 'var(--text-muted)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: 4,
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            ↻ クリア
          </button>
        </div>
      )}

      {/* メッセージ領域 */}
      {showMessages && (
        <div
          style={{
            flex: 1,
            minHeight: isSilent ? 0 : 80,
            display: 'flex',
            flexDirection: 'column',
            padding: '14px 16px',
            overflowY: 'auto',
            gap: 12,
          }}
        >
          {messages.length === 0 && !isStreaming && detectedBlock === 'none' && (
            <p
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                textAlign: 'center',
                lineHeight: 1.8,
                whiteSpace: 'pre-line',
                maxWidth: 280,
                margin: 'auto',
              }}
            >
              {HINTS[phase]}
            </p>
          )}

          {messages.map((msg, i) => (
            <MessageBubble
              key={i}
              message={msg}
              theme={theme}
              accent={accent}
              onRetry={msg.role === 'error' && i === messages.length - 1 ? onRetry : undefined}
            />
          ))}

          {isStreaming && (
            <MessageBubble
              message={{ role: 'assistant', content: streamBuffer }}
              theme={theme}
              accent={accent}
              streaming
            />
          )}

          {!isStreaming && detectedBlock !== 'none' && (
            <BlockNotificationBanner block={detectedBlock} onAsk={onAskBlock} onDismiss={onDismissBlock} />
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* 入力欄 */}
      <div style={{ padding: isSilent ? '10px 14px 12px' : '8px 12px 12px', flexShrink: 0 }}>
        <div
          style={{
            background: 'var(--bg-deep)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '8px 10px 6px',
            opacity: isStreaming ? 0.7 : 1,
            transition: 'opacity 180ms',
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={isStreaming ? '応答を待っています…' : PLACEHOLDERS[phase]}
            rows={isSilent ? 1 : 2}
            disabled={isStreaming}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              color: 'var(--text)',
              fontSize: 12,
              fontFamily: 'inherit',
              lineHeight: 1.6,
              padding: 0,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>
              Enter で送信 / Shift+Enter で改行
            </span>
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              style={{
                padding: '3px 12px',
                fontSize: 11,
                background: canSend ? accent : 'var(--border)',
                color: canSend ? 'var(--bg-deep)' : 'var(--text-muted)',
                border: 'none',
                borderRadius: 6,
                cursor: canSend ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                fontWeight: 600,
                letterSpacing: '0.05em',
                transition: 'all 160ms',
              }}
            >
              {isStreaming ? '応答中...' : '送信'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================
// サブコンポーネント
// =========================================

function BlockNotificationBanner({
  block, onAsk, onDismiss,
}: {
  block: Exclude<BlockType, 'none'>;
  onAsk: () => void;
  onDismiss: () => void;
}) {
  const labels: Record<Exclude<BlockType, 'none'>, { title: string; desc: string }> = {
    idea: { title: 'アイデア停滞を検知', desc: 'しばらく入力が止まっています。思考を動かす問いを聞きますか？' },
    structure: { title: '構造停滞を検知', desc: '同じ箇所の編集が繰り返されています。構造的な問いを聞きますか？' },
    motivation: { title: '執筆リズムの乱れを検知', desc: '少し疲れているかもしれません。小さな一歩の問いを聞きますか？' },
  };
  const { title, desc } = labels[block];

  return (
    <div
      className="rounded-lg px-3 py-2.5 text-xs"
      style={{
        background: 'rgba(var(--accent-rgb, 120,120,200), 0.08)',
        border: '1px solid rgba(var(--accent-rgb, 120,120,200), 0.2)',
        color: 'var(--text)',
        animation: 'bannerSlideUp 360ms ease-out',
      }}
    >
      <div className="font-medium mb-1" style={{ color: 'var(--accent)' }}>{title}</div>
      <p style={{ color: 'var(--text-mid)', marginBottom: '8px', lineHeight: '1.6' }}>{desc}</p>
      <div className="flex gap-2">
        <button
          type="button"
          className="text-xs"
          style={{
            padding: '3px 10px',
            borderRadius: '6px',
            background: 'var(--accent)',
            color: 'var(--bg-deep)',
            border: 'none',
            cursor: 'pointer',
          }}
          onClick={onAsk}
        >
          問いを聞く
        </button>
        <button
          type="button"
          className="text-xs"
          style={{
            padding: '3px 10px',
            borderRadius: '6px',
            background: 'transparent',
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
          }}
          onClick={onDismiss}
        >
          無視する
        </button>
      </div>
    </div>
  );
}

function MessageBubble({
  message, theme, accent, streaming = false, onRetry,
}: {
  message: ChatMessage;
  theme: 'dark' | 'light';
  accent: string;
  streaming?: boolean;
  onRetry?: () => void;
}) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isError = message.role === 'error';

  const bubbleBg = isUser
    ? 'var(--accent)'
    : isError
      ? (theme === 'dark' ? 'rgba(200, 60, 60, 0.25)' : 'rgba(200, 60, 60, 0.15)')
      : (theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)');

  const textColor = isUser
    ? (theme === 'dark' ? 'var(--bg-deep)' : '#fff')
    : isError
      ? (theme === 'dark' ? 'rgba(255,120,120,0.95)' : 'rgba(180,40,40,0.9)')
      : 'var(--text)';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        style={{
          maxWidth: '88%',
          background: bubbleBg,
          color: textColor,
          borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
          padding: '8px 12px',
          fontSize: '12px',
          lineHeight: '1.75',
          whiteSpace: isAssistant ? 'normal' : 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {isAssistant ? <MarkdownContent content={message.content} theme={theme} /> : message.content}
        {isError && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              display: 'block',
              marginTop: '6px',
              padding: '2px 10px',
              borderRadius: '6px',
              background: 'transparent',
              color: theme === 'dark' ? 'rgba(255,120,120,0.85)' : 'rgba(180,40,40,0.8)',
              border: `1px solid ${theme === 'dark' ? 'rgba(255,120,120,0.4)' : 'rgba(180,40,40,0.3)'}`,
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            ↺ 再試行
          </button>
        )}
        {streaming && (
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: '2px',
              height: '12px',
              background: accent,
              marginLeft: '2px',
              verticalAlign: 'middle',
              animation: 'caretBlink 0.9s steps(2) infinite',
            }}
          />
        )}
      </div>
    </div>
  );
}

function MarkdownContent({ content, theme }: { content: string; theme: 'dark' | 'light' }) {
  const codeBg = theme === 'dark' ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.06)';
  const quoteBorder = theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';

  return (
    <div className="ai-markdown">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p style={{ margin: '0 0 0.6em 0' }}>{children}</p>,
          ul: ({ children }) => (
            <ul style={{ margin: '0 0 0.6em 0', paddingLeft: '1.4em', listStyle: 'disc' }}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol style={{ margin: '0 0 0.6em 0', paddingLeft: '1.4em', listStyle: 'decimal' }}>{children}</ol>
          ),
          li: ({ children }) => <li style={{ marginBottom: '0.2em' }}>{children}</li>,
          h1: ({ children }) => (
            <h1 style={{ fontSize: '14px', fontWeight: 600, margin: '0.2em 0 0.4em 0' }}>{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 style={{ fontSize: '13px', fontWeight: 600, margin: '0.2em 0 0.4em 0' }}>{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 style={{ fontSize: '12px', fontWeight: 600, margin: '0.2em 0 0.4em 0' }}>{children}</h3>
          ),
          code: ({ className, children }) => {
            const isBlock = Boolean(className);
            if (isBlock) {
              return <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: '11px' }}>{children}</code>;
            }
            return (
              <code
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '11px',
                  background: codeBg,
                  padding: '1px 4px',
                  borderRadius: '3px',
                }}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre
              style={{
                background: codeBg,
                padding: '8px 10px',
                borderRadius: '4px',
                margin: '0 0 0.6em 0',
                overflowX: 'auto',
                whiteSpace: 'pre',
              }}
            >
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote
              style={{
                borderLeft: `2px solid ${quoteBorder}`,
                paddingLeft: '8px',
                margin: '0 0 0.6em 0',
                opacity: 0.85,
              }}
            >
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
              {children}
            </a>
          ),
          hr: () => <hr style={{ border: 'none', borderTop: `1px solid ${quoteBorder}`, margin: '0.6em 0' }} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

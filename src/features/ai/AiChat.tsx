/**
 * AIチャットUI
 * メッセージ一覧・入力・ストリーミング送受信を担当する。
 * AiPanel からレイアウトモードに依存しない形で利用される。
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import ReactMarkdown from 'react-markdown';
import { useAppStore } from '@/shared/stores/appStore';
import { useAiStore, type ChatMessage } from '@/shared/stores/aiStore';
import { useUIStore } from '@/shared/stores/uiStore';
import type { AiChunkPayload, AiMessage } from '@/shared/types';

/** 外部からメッセージ送信をトリガーするためのハンドル */
export interface AiChatHandle {
  sendMessage: (text: string) => void;
}

interface AiChatProps {
  /** 外部（クイックアクション等）からの送信用 ref */
  chatRef?: React.RefObject<AiChatHandle | null>;
}

export function AiChat({ chatRef }: AiChatProps) {
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const {
    messages, isStreaming, streamBuffer,
    addUserMessage, startAssistantMessage, appendChunk,
    finalizeAssistantMessage, setStreamError, clearHistory,
  } = useAiStore();
  const theme = useUIStore((s) => s.theme);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 新メッセージ追加時に最下部へスクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamBuffer]);

  const doSend = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming || !currentProjectId) return;

    setInput('');
    addUserMessage(text.trim());
    startAssistantMessage();

    let unlistenFn: (() => void) | null = null;
    try {
      unlistenFn = await listen<AiChunkPayload>('ai-chunk', (event) => {
        const { content, done, error } = event.payload;
        if (error) {
          setStreamError(error);
          unlistenFn?.();
          return;
        }
        if (done) {
          finalizeAssistantMessage();
          unlistenFn?.();
          return;
        }
        appendChunk(content);
      });

      // 'error' ロールはUI表示用なのでRustへ送らずに除外する
      const wireMessages: AiMessage[] = [
        ...messages
          .filter((m): m is ChatMessage & { role: 'user' | 'assistant' } => m.role !== 'error')
          .map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: text.trim() },
      ];
      await invoke('ai_send_message', {
        projectId: currentProjectId,
        messages: wireMessages,
      });
    } catch (e) {
      setStreamError(String(e));
      unlistenFn?.();
    }
  }, [isStreaming, currentProjectId, messages, addUserMessage, startAssistantMessage, appendChunk, finalizeAssistantMessage, setStreamError]);

  // 外部から送信できるよう ref を公開
  useEffect(() => {
    if (chatRef && 'current' in chatRef) {
      (chatRef as React.MutableRefObject<AiChatHandle | null>).current = { sendMessage: doSend };
    }
  }, [chatRef, doSend]);

  const handleSend = () => doSend(input);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ヘッダー */}
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span
          className="text-xs font-medium"
          style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}
        >
          AI アシスタント
        </span>
        <button
          className="text-xs"
          style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={clearHistory}
          title="会話をクリア"
        >
          クリア
        </button>
      </div>

      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && !isStreaming && (
          <p
            className="text-xs text-center mt-8"
            style={{ color: 'var(--text-muted)', lineHeight: '1.8' }}
          >
            執筆について何でも聞いてみてください。
            <br />
            あらすじ、キャラクター、文体など。
          </p>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} theme={theme} />
        ))}

        {isStreaming && (
          <MessageBubble
            message={{ role: 'assistant', content: streamBuffer }}
            theme={theme}
            streaming
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 入力エリア */}
      <div
        className="flex-shrink-0 px-3 pb-3 pt-2"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div className="flex flex-col gap-2">
          <textarea
            ref={textareaRef}
            className="w-full text-xs resize-none"
            rows={3}
            placeholder="メッセージを入力… (Enter で送信 / Shift+Enter で改行)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            style={{
              background: 'var(--bg)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '8px',
              outline: 'none',
              fontFamily: 'inherit',
              lineHeight: '1.6',
              opacity: isStreaming ? 0.6 : 1,
            }}
          />
          <button
            className="btn btn-primary text-xs self-end"
            style={{ padding: '4px 14px' }}
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
          >
            {isStreaming ? '応答中...' : '送信'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================
// サブコンポーネント
// =========================================

function MessageBubble({
  message,
  theme,
  streaming = false,
}: {
  message: ChatMessage;
  theme: 'dark' | 'light';
  streaming?: boolean;
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
        {isAssistant ? (
          <MarkdownContent content={message.content} theme={theme} />
        ) : (
          message.content
        )}
        {streaming && (
          <span
            style={{
              display: 'inline-block',
              width: '2px',
              height: '12px',
              background: 'var(--text-mid)',
              marginLeft: '2px',
              verticalAlign: 'middle',
              animation: 'blink 1s step-end infinite',
            }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * AI応答のマークダウンレンダラ。
 * 吹き出し内に収めるため、段落・リスト・見出しのマージンを詰めている。
 */
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
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)', textDecoration: 'underline' }}
            >
              {children}
            </a>
          ),
          hr: () => (
            <hr style={{ border: 'none', borderTop: `1px solid ${quoteBorder}`, margin: '0.6em 0' }} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * AIチャットUI
 * メッセージ一覧・入力・ストリーミング送受信を担当する。
 * 送信時にペルソナ・口調・コンテキストからシステムプロンプトを動的構築する。
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import ReactMarkdown from 'react-markdown';
import { useAppStore } from '@/shared/stores/appStore';
import { useEditorStore } from '@/shared/stores/editorStore';
import {
  useAiStore, type ChatMessage,
  PERSONA_PROMPTS, TONE_PREFIXES, CONTEXT_MAX_CHARS,
} from '@/shared/stores/aiStore';
import { useUIStore } from '@/shared/stores/uiStore';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import type {
  AiChunkPayload, AiMessage, AiContextSource,
  Character, CharacterData,
  GlossaryItem, GlossaryData,
  Plot, PlotData,
  Material, MaterialData,
  Synopsis,
  PlotThread, PlotThreadData,
} from '@/shared/types';

/** 外部からメッセージ送信・テンプレート挿入をトリガーするためのハンドル */
export interface AiChatHandle {
  sendMessage: (text: string) => void;
  insertTemplate: (text: string) => void;
}

interface AiChatProps {
  chatRef?: React.RefObject<AiChatHandle | null>;
}

/** コンテキストデータをテキストにシリアライズ */
function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…（省略）' : text;
}

/** コンテキストソースからデータを取得してテキスト化 */
async function fetchContextData(
  sources: AiContextSource[],
  projectId: string,
  episodeBody: string,
): Promise<string> {
  const parts: string[] = [];

  for (const source of sources) {
    try {
      switch (source) {
        case 'body': {
          const snippet = truncate(episodeBody, CONTEXT_MAX_CHARS.body);
          if (snippet) parts.push(`【本文】\n${snippet}`);
          break;
        }
        case 'characters': {
          const raw = await invoke<unknown[]>('get_characters', { projectId });
          const chars = toCamelCase<Character[]>(raw);
          const text = chars.map((c) => {
            const d: CharacterData = JSON.parse(c.data || '{}');
            const profile = d.profile;
            return `${c.name}（${c.category}）: ${profile?.personality || ''} ${profile?.background || ''}`.trim();
          }).join('\n');
          if (text) parts.push(`【人物】\n${truncate(text, CONTEXT_MAX_CHARS.characters)}`);
          break;
        }
        case 'glossary': {
          const raw = await invoke<unknown[]>('get_glossary', { projectId });
          const items = toCamelCase<GlossaryItem[]>(raw);
          const text = items.map((g) => {
            const d: GlossaryData = JSON.parse(g.data || '{}');
            return `${g.term}（${g.category}）: ${d.description || ''}`.trim();
          }).join('\n');
          if (text) parts.push(`【用語】\n${truncate(text, CONTEXT_MAX_CHARS.glossary)}`);
          break;
        }
        case 'plot': {
          const raw = await invoke<unknown[]>('get_plots', { projectId });
          const plots = toCamelCase<Plot[]>(raw);
          const text = plots.map((p) => {
            const d: PlotData = JSON.parse(p.data || '{}');
            const nodes = d.nodes?.map((n) => `  ${n.label}: ${n.content}`).join('\n') || '';
            return `${p.title}（${p.plotType}）\n${nodes}`.trim();
          }).join('\n\n');
          if (text) parts.push(`【プロット】\n${truncate(text, CONTEXT_MAX_CHARS.plot)}`);
          break;
        }
        case 'worldbuilding': {
          const raw = await invoke<unknown[]>('get_materials', { projectId });
          const materials = toCamelCase<Material[]>(raw);
          const text = materials
            .filter((m) => m.category === '世界観' || m.book === '世界観設定' || m.book === '世界観')
            .map((m) => {
              const d: MaterialData = JSON.parse(m.data || '{}');
              return `${m.title}: ${d.content || ''}`.trim();
            }).join('\n');
          if (text) parts.push(`【世界観】\n${truncate(text, CONTEXT_MAX_CHARS.worldbuilding)}`);
          break;
        }
        case 'synopsis': {
          const raw = await invoke<unknown>('get_synopsis', { projectId });
          const synopsis = raw ? toCamelCase<Synopsis>(raw) : null;
          if (synopsis?.content) {
            parts.push(`【あらすじ】\n${truncate(synopsis.content, CONTEXT_MAX_CHARS.synopsis)}`);
          }
          break;
        }
        case 'foreshadowing': {
          const raw = await invoke<unknown[]>('get_plot_threads', { projectId });
          const threads = toCamelCase<PlotThread[]>(raw);
          if (threads.length > 0) {
            const text = threads.map((t) => {
              const d: PlotThreadData = JSON.parse(t.data || '{}');
              return `${t.title}（${t.category}）[${d.status}]: ${d.description}`.trim();
            }).join('\n');
            parts.push(`【伏線トラッカー】\n${truncate(text, CONTEXT_MAX_CHARS.foreshadowing)}`);
          }
          break;
        }
      }
    } catch {
      // コンテキスト取得失敗は無視して続行
    }
  }

  return parts.join('\n\n');
}

export function AiChat({ chatRef }: AiChatProps) {
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const currentEpisode = useEditorStore((s) => s.currentEpisode);
  const {
    messages, isStreaming, streamBuffer,
    addUserMessage, startAssistantMessage, appendChunk,
    finalizeAssistantMessage, setStreamError, clearHistory,
    persona, tone, contextSources,
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

      // システムプロンプトを動的構築
      const systemParts: string[] = [
        PERSONA_PROMPTS[persona],
        TONE_PREFIXES[tone],
      ];

      // コンテキストデータを取得
      if (contextSources.length > 0) {
        const contextText = await fetchContextData(
          contextSources,
          currentProjectId,
          currentEpisode?.body ?? '',
        );
        if (contextText) {
          systemParts.push('以下は参考情報です。必要に応じて活用してください。\n\n' + contextText);
        }
      }

      const systemPrompt = systemParts.join('\n\n');

      // 'error' ロールはUI表示用なのでRustへ送らずに除外する
      const wireMessages: AiMessage[] = [
        { role: 'system', content: systemPrompt },
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
  }, [isStreaming, currentProjectId, currentEpisode, messages, addUserMessage, startAssistantMessage, appendChunk, finalizeAssistantMessage, setStreamError, persona, tone, contextSources]);

  // 外部から送信・テンプレート挿入できるよう ref を公開
  useEffect(() => {
    if (chatRef && 'current' in chatRef) {
      (chatRef as React.MutableRefObject<AiChatHandle | null>).current = {
        sendMessage: doSend,
        insertTemplate: (text: string) => {
          setInput(text);
          // テキストエリアにフォーカス
          setTimeout(() => textareaRef.current?.focus(), 50);
        },
      };
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

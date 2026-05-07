/**
 * AIチャットUI
 * メッセージ一覧・入力・ストリーミング送受信を担当する。
 * 送信時に catalystPromptBuilder でシステムプロンプトを動的構築する。
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import ReactMarkdown from 'react-markdown';
import { useAppStore } from '@/shared/stores/appStore';
import { useEditorStore } from '@/shared/stores/editorStore';
import {
  useAiStore, type ChatMessage,
  CONTEXT_MAX_CHARS,
} from '@/shared/stores/aiStore';
import { useUIStore } from '@/shared/stores/uiStore';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import { buildCatalystPrompt } from './catalystPromptBuilder';
import type {
  AiChunkPayload, AiMessage, AiContextSource, BlockType,
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
    removeLastError, loadMessagesForProject,
    phase, creatorType, detectedBlock, creativeCore,
    tone, contextSources,
    setDetectedBlock,
    socratesMode, socratesDepth, incrementSocratesDepth,
  } = useAiStore();
  const theme = useUIStore((s) => s.theme);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const retryTextRef = useRef('');
  const prevProjectRef = useRef<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamBuffer]);

  // プロジェクト切替時: 旧プロジェクトの履歴を保存 → 新プロジェクトの履歴を復元
  useEffect(() => {
    const prev = prevProjectRef.current;
    if (prev) {
      const toSave = messages.filter((m) => m.role !== 'error').slice(-50);
      try { localStorage.setItem(`story-attic-ai-chat-${prev}`, JSON.stringify(toSave)); } catch { /* 無視 */ }
    }
    if (currentProjectId) {
      loadMessagesForProject(currentProjectId);
    }
    prevProjectRef.current = currentProjectId ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId]);

  // メッセージ変化時に自動保存
  useEffect(() => {
    if (!currentProjectId || messages.length === 0) return;
    const toSave = messages.filter((m) => m.role !== 'error').slice(-50);
    try { localStorage.setItem(`story-attic-ai-chat-${currentProjectId}`, JSON.stringify(toSave)); } catch { /* 無視 */ }
  }, [messages, currentProjectId]);

  const doSend = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming || !currentProjectId) return;

    retryTextRef.current = text.trim();
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
          incrementSocratesDepth();
          unlistenFn?.();
          return;
        }
        appendChunk(content);
      });

      // コンテキストデータを取得
      const contextData = contextSources.length > 0
        ? await fetchContextData(contextSources, currentProjectId, currentEpisode?.body ?? '')
        : '';

      // catalystPromptBuilder でシステムプロンプトを動的構築
      const systemPrompt = buildCatalystPrompt({
        phase,
        creatorType,
        detectedBlock,
        creativeCore,
        tone,
        contextData,
        socratesMode,
        socratesDepth,
      });

      // 'error' ロールと 'system' ロールはRustへ送らずに除外する
      const wireMessages: AiMessage[] = [
        ...messages
          .filter((m): m is ChatMessage & { role: 'user' | 'assistant' } => m.role !== 'error')
          .map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: text.trim() },
      ];

      await invoke('ai_send_message', {
        projectId: currentProjectId,
        messages: wireMessages,
        systemPrompt,
      });
    } catch (e) {
      setStreamError(String(e));
      unlistenFn?.();
    }
  }, [isStreaming, currentProjectId, currentEpisode, messages, addUserMessage, startAssistantMessage, appendChunk, finalizeAssistantMessage, incrementSocratesDepth, setStreamError, phase, creatorType, detectedBlock, creativeCore, tone, contextSources, socratesMode, socratesDepth]);

  useEffect(() => {
    if (chatRef && 'current' in chatRef) {
      (chatRef as React.MutableRefObject<AiChatHandle | null>).current = {
        sendMessage: doSend,
        insertTemplate: (text: string) => {
          setInput(text);
          setTimeout(() => textareaRef.current?.focus(), 50);
        },
      };
    }
  }, [chatRef, doSend]);

  const handleRetry = useCallback(() => {
    removeLastError();
    doSend(retryTextRef.current);
  }, [removeLastError, doSend]);

  const handleSend = () => doSend(input);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isWritePhase = phase === 'write';

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ヘッダー */}
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-medium"
            style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}
          >
            {isWritePhase ? '静かに見守り中...' : 'AI 思考パートナー'}
          </span>
          {socratesMode && (
            <span
              className="text-xs"
              style={{
                padding: '1px 7px',
                borderRadius: '8px',
                background: 'rgba(139,124,246,0.12)',
                border: '1px solid rgba(139,124,246,0.4)',
                color: '#8b7cf6',
                fontWeight: 500,
              }}
            >
              深掘り {socratesDepth}/5
            </span>
          )}
        </div>
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
        {/* 停滞検知バナー */}
        {messages.length === 0 && !isStreaming && detectedBlock !== 'none' && (
          <BlockNotificationBanner
            block={detectedBlock}
            onAsk={() => {
              const blockPrompts: Record<string, string> = {
                idea: 'アイデア停滞を感じています。創作を再起動する問いをください。',
                structure: '構造的な停滞を感じています。このシーンについて問いをください。',
                motivation: '少し書くのが重くなっています。小さく始められる問いをください。',
              };
              doSend(blockPrompts[detectedBlock] ?? '');
            }}
            onDismiss={() => setDetectedBlock('none')}
          />
        )}

        {/* 空メッセージ時のヒント */}
        {messages.length === 0 && !isStreaming && detectedBlock === 'none' && (
          <p
            className="text-xs text-center mt-8"
            style={{ color: 'var(--text-muted)', lineHeight: '1.8' }}
          >
            {isWritePhase
              ? '執筆に集中してください。\n必要なときだけ呼んでください。'
              : '創作について何でも話しかけてください。\n問いで思考を深めます。'}
          </p>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            message={msg}
            theme={theme}
            onRetry={msg.role === 'error' && i === messages.length - 1 ? handleRetry : undefined}
          />
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
        style={{
          borderTop: '1px solid var(--border)',
          opacity: isWritePhase ? 0.7 : 1,
          transition: 'opacity 300ms',
        }}
      >
        <div className="flex flex-col gap-2">
          <textarea
            ref={textareaRef}
            className="w-full text-xs resize-none"
            rows={3}
            placeholder={isWritePhase
              ? '執筆中です。必要なときだけ入力してください…'
              : 'メッセージを入力… (Enter で送信 / Shift+Enter で改行)'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            style={{
              background: 'var(--bg)',
              color: 'var(--text)',
              border: `1px solid ${isWritePhase ? 'rgba(var(--border-rgb, 100,100,100), 0.4)' : 'var(--border)'}`,
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

function BlockNotificationBanner({
  block,
  onAsk,
  onDismiss,
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
      }}
    >
      <div className="font-medium mb-1" style={{ color: 'var(--accent)' }}>{title}</div>
      <p style={{ color: 'var(--text-mid)', marginBottom: '8px', lineHeight: '1.6' }}>{desc}</p>
      <div className="flex gap-2">
        <button
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
  message,
  theme,
  streaming = false,
  onRetry,
}: {
  message: ChatMessage;
  theme: 'dark' | 'light';
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
        {isAssistant ? (
          <MarkdownContent content={message.content} theme={theme} />
        ) : (
          message.content
        )}
        {isError && onRetry && (
          <button
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

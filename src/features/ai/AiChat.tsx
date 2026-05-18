/**
 * AiChat — AI 対話のロジック層
 * メッセージ送信・ストリーミング送受信・コンテキスト構築を担当する。
 * 表示は ChatArea に委譲する。
 * 送信時に catalystPromptBuilder でシステムプロンプトを動的構築する。
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useAppStore } from '@/shared/stores/appStore';
import { useEditorStore } from '@/shared/stores/editorStore';
import {
  useAiStore, type ChatMessage,
  CONTEXT_MAX_CHARS,
} from '@/shared/stores/aiStore';
import { useUIStore } from '@/shared/stores/uiStore';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import { buildCatalystPrompt } from './catalystPromptBuilder';
import { ChatArea } from './ChatArea';
import type { WriteLevel } from './types';
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
  writeLevel: WriteLevel;
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

export function AiChat({ chatRef, writeLevel }: AiChatProps) {
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
    setSocratesMode, resetSocrates,
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

  const handleClear = () => {
    if (messages.length === 0) return;
    if (window.confirm('会話履歴を消去しますか？元に戻せません。')) {
      clearHistory();
    }
  };

  const handleAskBlock = () => {
    if (detectedBlock === 'none') return;
    const blockPrompts: Record<string, string> = {
      idea: 'アイデア停滞を感じています。創作を再起動する問いをください。',
      structure: '構造的な停滞を感じています。このシーンについて問いをください。',
      motivation: '少し書くのが重くなっています。小さく始められる問いをください。',
    };
    doSend(blockPrompts[detectedBlock] ?? '');
  };

  return (
    <ChatArea
      phase={phase}
      writeLevel={writeLevel}
      isStreaming={isStreaming}
      messages={messages}
      streamBuffer={streamBuffer}
      theme={theme}
      input={input}
      onInputChange={setInput}
      onSend={handleSend}
      onKeyDown={handleKeyDown}
      onRetry={handleRetry}
      onClear={handleClear}
      socratesMode={socratesMode}
      socratesDepth={socratesDepth}
      onStartSocrates={() => setSocratesMode(true)}
      onResetSocrates={resetSocrates}
      detectedBlock={detectedBlock}
      onAskBlock={handleAskBlock}
      onDismissBlock={() => setDetectedBlock('none')}
      textareaRef={textareaRef}
      messagesEndRef={messagesEndRef}
    />
  );
}

import { create } from 'zustand';
import type { AiPersona, AiTone, AiContextSource } from '../types';

/**
 * UIで表示するチャットメッセージ。
 * ユーザー発話・AI応答・エラー表示を統一して扱うための型。
 * 'error' はUI専用ロールで、Rust送信前にフィルタで除外される
 * （AiPanel.tsx の `ai_send_message` 呼び出し箇所を参照）。
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'error';
  content: string;
}

/** ペルソナ別システムプロンプト */
export const PERSONA_PROMPTS: Record<AiPersona, string> = {
  reader: 'あなたは小説の熱心な読者です。読者目線でフィードバックしてください。',
  editor: 'あなたはプロの小説編集者です。構造・文体・市場性の観点からアドバイスしてください。',
  assistant: 'あなたは執筆のアシスタントです。アイデア出し・表現の提案・調査の手伝いをしてください。',
};

/** 口調プレフィックス */
export const TONE_PREFIXES: Record<AiTone, string> = {
  formal: '丁寧語で応答してください。',
  casual: 'フランクな口調で応答してください。',
  harsh: '遠慮なく厳しい指摘をしてください。甘い評価は不要です。',
};

/** コンテキストソースのラベル */
export const CONTEXT_LABELS: Record<AiContextSource, string> = {
  body: '本文',
  characters: '人物',
  glossary: '用語',
  plot: 'プロット',
  worldbuilding: '世界観',
};

/** コンテキストソース別の文字数上限 */
export const CONTEXT_MAX_CHARS: Record<AiContextSource, number> = {
  body: 1200,
  characters: 3000,
  glossary: 2000,
  plot: 2000,
  worldbuilding: 1000,
};

interface AiState {
  messages: ChatMessage[];
  isStreaming: boolean;
  /** ストリーミング中に蓄積するバッファ */
  streamBuffer: string;

  /** セッション単位のペルソナ */
  persona: AiPersona;
  /** セッション単位の口調 */
  tone: AiTone;
  /** セッション単位のコンテキストソース選択 */
  contextSources: AiContextSource[];

  addUserMessage: (content: string) => void;
  startAssistantMessage: () => void;
  appendChunk: (chunk: string) => void;
  finalizeAssistantMessage: () => void;
  setStreamError: (error: string) => void;
  clearHistory: () => void;

  setPersona: (persona: AiPersona) => void;
  setTone: (tone: AiTone) => void;
  toggleContextSource: (source: AiContextSource) => void;
}

export const useAiStore = create<AiState>((set) => ({
  messages: [],
  isStreaming: false,
  streamBuffer: '',
  persona: 'assistant',
  tone: 'formal',
  contextSources: ['body'],

  addUserMessage: (content) =>
    set((s) => ({ messages: [...s.messages, { role: 'user', content }] })),

  startAssistantMessage: () =>
    set({ isStreaming: true, streamBuffer: '' }),

  appendChunk: (chunk) =>
    set((s) => ({ streamBuffer: s.streamBuffer + chunk })),

  finalizeAssistantMessage: () =>
    set((s) => ({
      isStreaming: false,
      messages: [...s.messages, { role: 'assistant', content: s.streamBuffer }],
      streamBuffer: '',
    })),

  setStreamError: (error) =>
    set((s) => ({
      isStreaming: false,
      messages: [...s.messages, { role: 'error', content: error }],
      streamBuffer: '',
    })),

  clearHistory: () =>
    set({ messages: [], streamBuffer: '', isStreaming: false }),

  setPersona: (persona) => set({ persona }),
  setTone: (tone) => set({ tone }),
  toggleContextSource: (source) =>
    set((s) => {
      const has = s.contextSources.includes(source);
      return {
        contextSources: has
          ? s.contextSources.filter((c) => c !== source)
          : [...s.contextSources, source],
      };
    }),
}));

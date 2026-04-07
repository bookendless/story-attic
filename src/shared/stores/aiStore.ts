import { create } from 'zustand';

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

interface AiState {
  messages: ChatMessage[];
  isStreaming: boolean;
  /** ストリーミング中に蓄積するバッファ */
  streamBuffer: string;

  addUserMessage: (content: string) => void;
  startAssistantMessage: () => void;
  appendChunk: (chunk: string) => void;
  finalizeAssistantMessage: () => void;
  setStreamError: (error: string) => void;
  clearHistory: () => void;
}

export const useAiStore = create<AiState>((set) => ({
  messages: [],
  isStreaming: false,
  streamBuffer: '',

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
}));

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type {
  AiTone, AiContextSource,
  CreativePhase, CreatorType, BlockType, CreativeCore,
  AiSettings,
} from '../types';

/**
 * UIで表示するチャットメッセージ。
 * 'error' はUI専用ロールで、Rust送信前にフィルタで除外される。
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'error';
  content: string;
}

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
  synopsis: 'あらすじ',
  foreshadowing: '伏線',
};

/** コンテキストソース別の文字数上限 */
export const CONTEXT_MAX_CHARS: Record<AiContextSource, number> = {
  body: 1200,
  characters: 3000,
  glossary: 2000,
  plot: 2000,
  worldbuilding: 1000,
  synopsis: 3000,
  foreshadowing: 5000,
};

const PHASE_DEFAULT_SOURCES: Record<CreativePhase, AiContextSource[]> = {
  explore:   ['body', 'characters', 'synopsis'],
  structure: ['body', 'plot', 'foreshadowing', 'characters'],
  write:     ['body'],
  revise:    ['body', 'synopsis'],
};

const VALID_PHASES: CreativePhase[] = ['explore', 'structure', 'write', 'revise'];

function loadSavedPhase(): CreativePhase {
  try {
    const v = localStorage.getItem('story-attic-ai-phase') as CreativePhase;
    if (VALID_PHASES.includes(v)) return v;
  } catch { /* 無視 */ }
  return 'explore';
}

const INITIAL_PHASE = loadSavedPhase();

const DEFAULT_CREATIVE_CORE: CreativeCore = {
  theme: '',
  centralEmotion: '',
  coreQuestion: '',
};

interface AiState {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamBuffer: string;

  /** 創作フェーズ（セッション） */
  phase: CreativePhase;
  /** 作家タイプ（プロジェクト永続化） */
  creatorType: CreatorType;
  /** 検知された停滞タイプ（セッション） */
  detectedBlock: BlockType;
  /** 作品のCore（プロジェクト永続化） */
  creativeCore: CreativeCore;
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
  removeLastError: () => void;

  socratesMode: boolean;
  socratesDepth: number;

  setPhase: (phase: CreativePhase) => void;
  setCreatorType: (type: CreatorType) => void;
  setDetectedBlock: (block: BlockType) => void;
  setCreativeCore: (core: Partial<CreativeCore>) => void;
  setTone: (tone: AiTone) => void;
  toggleContextSource: (source: AiContextSource) => void;
  setSocratesMode: (mode: boolean) => void;
  incrementSocratesDepth: () => void;
  resetSocrates: () => void;

  /** プロジェクトロード時にDBからcreatorTypeを復元 */
  loadCreatorOsSettings: (projectId: string) => Promise<void>;
  /** creatorTypeをDBに永続化 */
  saveCreatorType: (projectId: string, type: CreatorType) => Promise<void>;
  /** creativeCoreをstoreに反映（保存はCreativeCoreEditorが担当） */
  loadCreativeCore: (core: Partial<CreativeCore>) => void;
  /** プロジェクト切替時にlocalStorageから会話履歴を復元 */
  loadMessagesForProject: (projectId: string) => void;
}

export const useAiStore = create<AiState>((set) => ({
  messages: [],
  isStreaming: false,
  streamBuffer: '',
  phase: INITIAL_PHASE,
  creatorType: 'explorer',
  detectedBlock: 'none',
  creativeCore: { ...DEFAULT_CREATIVE_CORE },
  tone: 'formal',
  contextSources: PHASE_DEFAULT_SOURCES[INITIAL_PHASE],
  socratesMode: false,
  socratesDepth: 0,

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

  removeLastError: () =>
    set((s) => {
      const msgs = [...s.messages];
      const lastIdx = msgs.length - 1;
      if (msgs[lastIdx]?.role !== 'error') return {};
      // 直前のuserメッセージもセットで削除してリトライ時に重複しないようにする
      const removeFrom = msgs[lastIdx - 1]?.role === 'user' ? lastIdx - 1 : lastIdx;
      return { messages: msgs.slice(0, removeFrom) };
    }),

  setPhase: (phase) => {
    try { localStorage.setItem('story-attic-ai-phase', phase); } catch { /* 無視 */ }
    set({ phase, contextSources: PHASE_DEFAULT_SOURCES[phase] });
  },
  setCreatorType: (creatorType) => set({ creatorType }),
  setDetectedBlock: (detectedBlock) => set({ detectedBlock }),
  setCreativeCore: (core) =>
    set((s) => ({ creativeCore: { ...s.creativeCore, ...core } })),
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
  setSocratesMode: (mode) => set({ socratesMode: mode, socratesDepth: 0 }),
  incrementSocratesDepth: () =>
    set((s) => {
      if (!s.socratesMode) return s;
      const next = s.socratesDepth + 1;
      if (next > 5) return { socratesMode: false, socratesDepth: 0 };
      return { socratesDepth: next };
    }),
  resetSocrates: () => set({ socratesMode: false, socratesDepth: 0 }),

  loadCreatorOsSettings: async (projectId) => {
    try {
      const settings = await invoke<AiSettings>('ai_get_settings', { projectId });
      if (settings.creator_type === 'architect' || settings.creator_type === 'explorer') {
        set({ creatorType: settings.creator_type });
      }
    } catch {
      // 設定未存在は無視
    }
  },

  saveCreatorType: async (projectId, type) => {
    try {
      const settings = await invoke<AiSettings>('ai_get_settings', { projectId });
      await invoke('ai_save_settings', {
        projectId,
        settings: { ...settings, creator_type: type },
      });
      set({ creatorType: type });
    } catch {
      // 保存失敗はstoreだけ更新
      set({ creatorType: type });
    }
  },

  loadCreativeCore: (core) =>
    set((s) => ({ creativeCore: { ...s.creativeCore, ...core } })),

  loadMessagesForProject: (projectId) =>
    set(() => {
      try {
        const stored = localStorage.getItem(`story-attic-ai-chat-${projectId}`);
        if (stored) {
          const msgs: ChatMessage[] = JSON.parse(stored);
          return { messages: msgs, streamBuffer: '', isStreaming: false };
        }
      } catch { /* 無視 */ }
      return { messages: [], streamBuffer: '', isStreaming: false };
    }),
}));

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { ChapterTree, Episode, EpisodeSummary } from '../types';
import { toCamelCase } from '../hooks/useTauriCommand';

interface EditorState {
  episodes: EpisodeSummary[];
  chapterTree: ChapterTree | null;
  currentEpisode: Episode | null;
  isDirty: boolean;
  isSaving: boolean;
  error: string | null;
  /** 最後に自動保存が完了した時刻（ISO文字列）。nullは未実行 */
  lastAutoSavedAt: string | null;

  /** デュアルビュー用：セカンダリエピソード */
  secondaryEpisode: Episode | null;
  secondaryIsDirty: boolean;

  loadChapterTree: (projectId: string) => Promise<void>;
  switchEpisode: (id: string) => Promise<void>;
  updateBody: (body: string) => void;
  save: () => Promise<void>;
  /** 自動保存を実行（成功時に lastAutoSavedAt を更新） */
  autoSave: () => Promise<void>;
  createEpisode: (projectId: string, title: string) => Promise<string>;
  renameEpisode: (id: string, title: string) => Promise<void>;
  deleteEpisode: (id: string) => Promise<void>;
  reorderEpisodes: (projectId: string, orderedIds: string[]) => Promise<void>;
  assignEpisodeToChapter: (episodeId: string, chapterId: string) => Promise<void>;
  unassignEpisode: (episodeId: string) => Promise<void>;

  /** デュアルビュー用：セカンダリエピソードの切替・更新・保存・クリア */
  switchSecondaryEpisode: (id: string) => Promise<void>;
  updateSecondaryBody: (body: string) => void;
  saveSecondary: () => Promise<void>;
  clearSecondary: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  episodes: [],
  chapterTree: null,
  currentEpisode: null,
  isDirty: false,
  isSaving: false,
  error: null,
  lastAutoSavedAt: null,
  secondaryEpisode: null,
  secondaryIsDirty: false,

  loadChapterTree: async (projectId: string) => {
    const raw = await invoke<unknown>('get_chapter_tree', { projectId });
    set({ chapterTree: toCamelCase<ChapterTree>(raw) });
  },

  switchEpisode: async (id: string) => {
    // 未保存の場合は先に保存
    if (get().isDirty) {
      await get().save();
    }
    const raw = await invoke<unknown>('get_episode', { id });
    set({ currentEpisode: toCamelCase<Episode>(raw), isDirty: false });
  },

  updateBody: (body: string) => {
    const current = get().currentEpisode;
    if (!current) return;
    set({
      currentEpisode: { ...current, body },
      isDirty: true,
    });
  },

  save: async () => {
    const { currentEpisode } = get();
    if (!currentEpisode || !get().isDirty) return;
    set({ isSaving: true });
    try {
      await invoke('save_episode', { id: currentEpisode.id, body: currentEpisode.body });
      set({ isDirty: false, isSaving: false });
      // チャプターツリーを再読み込みして文字数を更新
      await get().loadChapterTree(currentEpisode.projectId);
    } catch (e) {
      set({ error: String(e), isSaving: false });
    }
  },

  autoSave: async () => {
    const { currentEpisode, isDirty, isSaving } = get();
    if (!currentEpisode || !isDirty || isSaving) return;
    set({ isSaving: true });
    try {
      await invoke('save_episode', { id: currentEpisode.id, body: currentEpisode.body });
      const now = new Date().toISOString();
      set({ isDirty: false, isSaving: false, lastAutoSavedAt: now });
      await get().loadChapterTree(currentEpisode.projectId);
    } catch (e) {
      set({ error: String(e), isSaving: false });
    }
  },

  createEpisode: async (projectId: string, title: string) => {
    const id = await invoke<string>('create_episode', { projectId, title });
    await get().loadChapterTree(projectId);
    return id;
  },

  renameEpisode: async (id: string, title: string) => {
    await invoke('rename_episode', { id, title });
    const current = get().currentEpisode;
    if (current?.id === id) {
      set({ currentEpisode: { ...current, title } });
    }
    if (current) {
      await get().loadChapterTree(current.projectId);
    }
  },

  deleteEpisode: async (id: string) => {
    const current = get().currentEpisode;
    await invoke('delete_episode', { id });
    if (current?.id === id) {
      set({ currentEpisode: null, isDirty: false });
    }
    if (current) {
      await get().loadChapterTree(current.projectId);
    }
  },

  reorderEpisodes: async (projectId: string, orderedIds: string[]) => {
    await invoke('reorder_episodes', { projectId, orderedIds });
    await get().loadChapterTree(projectId);
  },

  assignEpisodeToChapter: async (episodeId: string, chapterId: string) => {
    await invoke('assign_episode_to_chapter', { episodeId, chapterId });
    const current = get().currentEpisode;
    if (current) {
      await get().loadChapterTree(current.projectId);
    }
  },

  unassignEpisode: async (episodeId: string) => {
    await invoke('unassign_episode', { episodeId });
    const current = get().currentEpisode;
    if (current) {
      await get().loadChapterTree(current.projectId);
    }
  },

  switchSecondaryEpisode: async (id: string) => {
    // セカンダリが未保存なら先に保存
    if (get().secondaryIsDirty) {
      await get().saveSecondary();
    }
    const raw = await invoke<unknown>('get_episode', { id });
    set({ secondaryEpisode: toCamelCase<Episode>(raw), secondaryIsDirty: false });
  },

  updateSecondaryBody: (body: string) => {
    const secondary = get().secondaryEpisode;
    if (!secondary) return;
    set({ secondaryEpisode: { ...secondary, body }, secondaryIsDirty: true });
  },

  saveSecondary: async () => {
    const { secondaryEpisode, secondaryIsDirty } = get();
    if (!secondaryEpisode || !secondaryIsDirty) return;
    try {
      await invoke('save_episode', { id: secondaryEpisode.id, body: secondaryEpisode.body });
      set({ secondaryIsDirty: false });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  clearSecondary: () => {
    set({ secondaryEpisode: null, secondaryIsDirty: false });
  },
}));

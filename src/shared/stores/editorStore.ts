import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { ChapterTree, Episode } from '../types';
import { toCamelCase } from '../hooks/useTauriCommand';
import { showToast } from './toastStore';
import { countHtmlChars } from '../utils/charCount';

/**
 * ツリー内の該当エピソードの文字数だけを差し替える。
 * 保存のたびに全ツリーを IPC で再取得するのを避けるためのローカル更新
 */
function updateTreeCharCount(
  tree: ChapterTree | null,
  episodeId: string,
  charCount: number,
): ChapterTree | null {
  if (!tree) return tree;
  const mapEp = <E extends { id: string; charCount: number }>(ep: E): E =>
    ep.id === episodeId ? { ...ep, charCount } : ep;
  return {
    ...tree,
    chapters: tree.chapters.map((c) => ({ ...c, episodes: c.episodes.map(mapEp) })),
    ungrouped: tree.ungrouped.map(mapEp),
  };
}

interface EditorState {
  chapterTree: ChapterTree | null;
  currentEpisode: Episode | null;
  isDirty: boolean;
  isSaving: boolean;
  error: string | null;
  /** 最後に自動保存が完了した時刻（ISO文字列）。nullは未実行 */
  lastAutoSavedAt: string | null;
  /** 最後にスナップショットを作成した時刻（ISO文字列）。nullは未実行 */
  lastSnapshotAt: string | null;

  /** デュアルビュー用：セカンダリエピソード */
  secondaryEpisode: Episode | null;
  secondaryIsDirty: boolean;

  loadChapterTree: (projectId: string) => Promise<void>;
  clearCurrentEpisode: () => void;
  switchEpisode: (id: string) => Promise<void>;
  updateBody: (body: string) => void;
  save: () => Promise<void>;
  /** 自動保存を実行（成功時に lastAutoSavedAt を更新） */
  autoSave: () => Promise<void>;
  /** 現在のエピソードのスナップショットを作成する */
  takeSnapshot: () => Promise<void>;
  setLastSnapshotAt: (at: string) => void;
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
  chapterTree: null,
  currentEpisode: null,
  isDirty: false,
  isSaving: false,
  error: null,
  lastAutoSavedAt: null,
  lastSnapshotAt: null,
  secondaryEpisode: null,
  secondaryIsDirty: false,

  loadChapterTree: async (projectId: string) => {
    const raw = await invoke<unknown>('get_chapter_tree', { projectId });
    set({ chapterTree: toCamelCase<ChapterTree>(raw) });
  },

  clearCurrentEpisode: () => {
    set({ currentEpisode: null, isDirty: false, secondaryEpisode: null, secondaryIsDirty: false });
  },

  switchEpisode: async (id: string) => {
    // 未保存の場合は先に保存＋スナップショット作成
    if (get().isDirty) {
      await get().save();
      await get().takeSnapshot();
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
      // 文字数はローカルで再計算してツリーへ反映（全ツリー再取得を避ける）
      const charCount = countHtmlChars(currentEpisode.body);
      set((s) => ({
        isDirty: false,
        isSaving: false,
        error: null,
        currentEpisode: s.currentEpisode?.id === currentEpisode.id
          ? { ...s.currentEpisode, charCount }
          : s.currentEpisode,
        chapterTree: updateTreeCharCount(s.chapterTree, currentEpisode.id, charCount),
      }));
    } catch (e) {
      // isDirty は true のまま維持し、本文を失わない
      set({ error: String(e), isSaving: false });
      showToast('error', '保存に失敗しました。再試行してください。', {
        label: '再試行',
        run: () => { void get().save(); },
      });
    }
  },

  autoSave: async () => {
    const { currentEpisode, isDirty, isSaving } = get();
    if (!currentEpisode || !isDirty || isSaving) return;
    set({ isSaving: true });
    try {
      await invoke('save_episode', { id: currentEpisode.id, body: currentEpisode.body });
      const now = new Date().toISOString();
      // 文字数はローカルで再計算してツリーへ反映（全ツリー再取得を避ける）
      const charCount = countHtmlChars(currentEpisode.body);
      set((s) => ({
        isDirty: false,
        isSaving: false,
        lastAutoSavedAt: now,
        error: null,
        currentEpisode: s.currentEpisode?.id === currentEpisode.id
          ? { ...s.currentEpisode, charCount }
          : s.currentEpisode,
        chapterTree: updateTreeCharCount(s.chapterTree, currentEpisode.id, charCount),
      }));
    } catch (e) {
      // isDirty は true のまま維持し、次回オートセーブ/手動保存で再試行される
      set({ error: String(e), isSaving: false });
      showToast('error', '自動保存に失敗しました。Ctrl+S で手動保存を試してください。', {
        label: '再試行',
        run: () => { void get().autoSave(); },
      });
    }
  },

  takeSnapshot: async () => {
    const { currentEpisode } = get();
    if (!currentEpisode) return;
    try {
      await invoke('save_snapshot', { episodeId: currentEpisode.id });
      const now = new Date().toISOString();
      set({ lastSnapshotAt: now });
    } catch {
      // スナップショット失敗は静かに無視
    }
  },

  setLastSnapshotAt: (at: string) => {
    set({ lastSnapshotAt: at });
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
      showToast('error', 'セカンダリエピソードの保存に失敗しました。', {
        label: '再試行',
        run: () => { void get().saveSecondary(); },
      });
    }
  },

  clearSecondary: () => {
    set({ secondaryEpisode: null, secondaryIsDirty: false });
  },
}));

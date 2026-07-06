import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Episode } from '../types';

// Tauri の invoke をモック（テスト内で挙動を差し替える）
const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { useEditorStore } from './editorStore';
import { useToastStore } from './toastStore';

function makeEpisode(overrides: Partial<Episode> = {}): Episode {
  return {
    id: 'ep-1',
    projectId: 'proj-1',
    title: 'テスト話',
    body: '<p>あいうえお</p>',
    sortOrder: 0,
    charCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('editorStore.save', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    useEditorStore.setState({
      currentEpisode: null,
      isDirty: false,
      isSaving: false,
      error: null,
      chapterTree: null,
    });
    useToastStore.setState({ toasts: [] });
  });

  it('保存成功で isDirty=false・error=null になり文字数が更新される', async () => {
    invokeMock.mockResolvedValue(undefined);
    useEditorStore.setState({ currentEpisode: makeEpisode(), isDirty: true });

    await useEditorStore.getState().save();

    const state = useEditorStore.getState();
    expect(invokeMock).toHaveBeenCalledWith('save_episode', {
      id: 'ep-1',
      body: '<p>あいうえお</p>',
    });
    expect(state.isDirty).toBe(false);
    expect(state.error).toBeNull();
    // あいうえお = 5文字
    expect(state.currentEpisode?.charCount).toBe(5);
  });

  it('保存失敗で isDirty=true を維持し error をセット、トーストを出す', async () => {
    invokeMock.mockRejectedValue(new Error('disk full'));
    useEditorStore.setState({ currentEpisode: makeEpisode(), isDirty: true });

    await useEditorStore.getState().save();

    const state = useEditorStore.getState();
    // 本文を失わないよう isDirty は true のまま
    expect(state.isDirty).toBe(true);
    expect(state.error).toContain('disk full');
    expect(useToastStore.getState().toasts.some((t) => t.type === 'error')).toBe(true);
  });

  it('isDirty=false のときは保存処理をスキップする', async () => {
    useEditorStore.setState({ currentEpisode: makeEpisode(), isDirty: false });
    await useEditorStore.getState().save();
    expect(invokeMock).not.toHaveBeenCalled();
  });
});

describe('editorStore.autoSave', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    useEditorStore.setState({
      currentEpisode: null,
      isDirty: false,
      isSaving: false,
      error: null,
      lastAutoSavedAt: null,
      chapterTree: null,
    });
  });

  it('自動保存成功で lastAutoSavedAt が更新される', async () => {
    invokeMock.mockResolvedValue(undefined);
    useEditorStore.setState({ currentEpisode: makeEpisode(), isDirty: true });

    await useEditorStore.getState().autoSave();

    const state = useEditorStore.getState();
    expect(state.isDirty).toBe(false);
    expect(state.lastAutoSavedAt).not.toBeNull();
  });
});

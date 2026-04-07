import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Project, ProjectSummary } from '../types';
import { toCamelCase } from '../hooks/useTauriCommand';

interface ProjectState {
  projects: ProjectSummary[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;

  loadProjects: () => Promise<void>;
  openProject: (id: string) => Promise<void>;
  createProject: (title: string) => Promise<string>;
  updateProject: (id: string, data: { title?: string; author?: string; description?: string }) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,

  loadProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const raw = await invoke<unknown[]>('list_projects');
      set({ projects: toCamelCase<ProjectSummary[]>(raw), isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  openProject: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const raw = await invoke<unknown>('get_project', { id });
      set({ currentProject: toCamelCase<Project>(raw), isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  createProject: async (title: string) => {
    const id = await invoke<string>('create_project', { title });
    await get().loadProjects();
    return id;
  },

  updateProject: async (id, data) => {
    await invoke('update_project', { id, data });
    // 現在のプロジェクトを再読み込み
    if (get().currentProject?.id === id) {
      await get().openProject(id);
    }
    await get().loadProjects();
  },

  deleteProject: async (id: string) => {
    await invoke('delete_project', { id });
    if (get().currentProject?.id === id) {
      set({ currentProject: null });
    }
    await get().loadProjects();
  },
}));

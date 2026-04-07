import { create } from 'zustand';

type AppView = 'home' | 'workspace';

interface AppState {
  currentView: AppView;
  currentProjectId: string | null;
  navigateTo: (view: AppView, projectId?: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'home',
  currentProjectId: null,
  navigateTo: (view, projectId = null) =>
    set({ currentView: view, currentProjectId: projectId }),
}));

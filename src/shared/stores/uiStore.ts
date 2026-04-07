import { create } from 'zustand';
import type { ProjectSettings, ProofreadSettings } from '../types';
import { DEFAULT_SETTINGS, DEFAULT_PROOFREAD_SETTINGS } from '../types';

/** エディタのビューモード */
export type EditorViewMode = 'editor' | 'diff' | 'proofread';

/** カラーテーマ */
export type ThemeMode = 'dark' | 'light';

/** パーティクル演出の種類 */
export type EffectType = 'rain' | 'snow' | 'sakura';

/** パーティクル密度 */
export type ParticleDensity = 'sparse' | 'normal' | 'dense';

/** 演出の設定 */
export interface AmbienceSettings {
  effectType: EffectType;
  density: ParticleDensity;
  speed: number;       // 1-10
  angle: number;       // -30 ~ 30 度
  opacity: number;     // 0.1 ~ 0.8
}

export const DEFAULT_AMBIENCE_SETTINGS: AmbienceSettings = {
  effectType: 'rain',
  density: 'normal',
  speed: 5,
  angle: 5,
  opacity: 0.3,
};

/** 環境音の種類 */
export type AmbientType = 'rain' | 'fireplace' | 'forest' | 'cafe' | 'waves';

/** タイピング音の種類 */
export type TypingSoundType = 'mechanical' | 'wooden' | 'soft' | 'none';

/** サウンド設定 */
export interface SoundSettings {
  enabled: boolean;
  masterVolume: number;          // 0 ~ 1
  ambientVolume: number;         // 0 ~ 1
  activeAmbients: AmbientType[]; // 同時再生する環境音
  typingType: TypingSoundType;
  typingVolume: number;          // 0 ~ 1
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  enabled: false,
  masterVolume: 0.5,
  ambientVolume: 0.5,
  activeAmbients: [],
  typingType: 'none',
  typingVolume: 0.3,
};

/** キャラクターウィジェット設定 */
export interface CharacterSettings {
  enabled: boolean;
}

export const DEFAULT_CHARACTER_SETTINGS: CharacterSettings = {
  enabled: true,
};

/** 右パネルのアクティブタブ */
export type RightPanelTab = 'plot' | 'character' | 'glossary' | 'material' | 'memo' | 'ai';

/** 右パネル幅のデフォルト・最小・最大 */
export const RIGHT_PANEL_DEFAULT_WIDTH = 280;
export const RIGHT_PANEL_MIN_WIDTH = 200;
export const RIGHT_PANEL_MAX_WIDTH = 450;

/** localStorageから右パネル幅を復元 */
function loadRightPanelWidth(): number {
  try {
    const stored = localStorage.getItem('story-attic-right-panel-width');
    if (stored) {
      const w = Number(stored);
      if (w >= RIGHT_PANEL_MIN_WIDTH && w <= RIGHT_PANEL_MAX_WIDTH) return w;
    }
  } catch {
    /* 無視 */
  }
  return RIGHT_PANEL_DEFAULT_WIDTH;
}

/** 右パネル幅をlocalStorageに保存 */
function saveRightPanelWidth(width: number) {
  try {
    localStorage.setItem('story-attic-right-panel-width', String(width));
  } catch {
    /* 無視 */
  }
}

/** localStorageからテーマを復元。無効値やエラー時はdarkを返す */
function loadTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem('story-attic-theme');
    if (stored === 'light') return 'light';
  } catch {
    /* localStorage使用不可時は無視 */
  }
  return 'dark';
}

/** localStorageから演出の設定を復元 */
function loadAmbienceSettings(): { enabled: boolean; settings: AmbienceSettings } {
  try {
    const stored = localStorage.getItem('story-attic-ambience');
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        enabled: !!parsed.enabled,
        settings: { ...DEFAULT_AMBIENCE_SETTINGS, ...parsed.settings },
      };
    }
    // 旧形式（story-attic-rain）からのマイグレーション
    const legacy = localStorage.getItem('story-attic-rain');
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const migrated = { ...DEFAULT_AMBIENCE_SETTINGS, ...parsed.settings, effectType: 'rain' as const };
      localStorage.removeItem('story-attic-rain');
      return { enabled: !!parsed.enabled, settings: migrated };
    }
  } catch {
    /* 無視 */
  }
  return { enabled: false, settings: DEFAULT_AMBIENCE_SETTINGS };
}

/** localStorageからキャラクター設定を復元 */
function loadCharacterSettings(): CharacterSettings {
  try {
    const stored = localStorage.getItem('story-attic-character');
    if (stored) {
      return { ...DEFAULT_CHARACTER_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    /* 無視 */
  }
  return DEFAULT_CHARACTER_SETTINGS;
}

/** キャラクター設定をlocalStorageに保存 */
function saveCharacterToStorage(settings: CharacterSettings) {
  try {
    localStorage.setItem('story-attic-character', JSON.stringify(settings));
  } catch {
    /* 無視 */
  }
}

/** localStorageからサウンド設定を復元 */
function loadSoundSettings(): SoundSettings {
  try {
    const stored = localStorage.getItem('story-attic-sound');
    if (stored) {
      return { ...DEFAULT_SOUND_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    /* 無視 */
  }
  return DEFAULT_SOUND_SETTINGS;
}

/** サウンド設定をlocalStorageに保存 */
function saveSoundToStorage(settings: SoundSettings) {
  try {
    localStorage.setItem('story-attic-sound', JSON.stringify(settings));
  } catch {
    /* 無視 */
  }
}

/** 演出の設定をlocalStorageに保存 */
function saveAmbienceToStorage(enabled: boolean, settings: AmbienceSettings) {
  try {
    localStorage.setItem('story-attic-ambience', JSON.stringify({ enabled, settings }));
  } catch {
    /* 無視 */
  }
}

interface UIState {
  leftPanelVisible: boolean;
  rightPanelVisible: boolean;
  searchBarVisible: boolean;
  isTategaki: boolean;
  settings: ProjectSettings;
  proofreadSettings: ProofreadSettings;

  /** 現在のカラーテーマ */
  theme: ThemeMode;

  /** 現在のエディタ表示モード */
  editorViewMode: EditorViewMode;
  /** 分析モーダル表示 */
  analysisModalVisible: boolean;
  /** 設定モーダル表示 */
  settingsModalVisible: boolean;

  /** パーティクル演出 */
  ambienceEnabled: boolean;
  ambienceSettings: AmbienceSettings;

  /** サウンド設定 */
  soundSettings: SoundSettings;

  /** キャラクターウィジェット設定 */
  characterSettings: CharacterSettings;

  /** AIパネル表示（フローティング用。右パネル内AIタブは rightPanelVisible で制御） */
  aiPanelVisible: boolean;
  /** AIパネルの表示モード */
  aiPanelMode: 'sidebar' | 'floating';

  /** 右パネルのアクティブタブ */
  activeRightTab: RightPanelTab;
  /** 右パネルの幅 (px) */
  rightPanelWidth: number;

  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleSearchBar: () => void;
  toggleTategaki: () => void;
  setSettings: (settings: ProjectSettings) => void;
  setProofreadSettings: (settings: ProofreadSettings) => void;
  setEditorViewMode: (mode: EditorViewMode) => void;
  toggleAnalysisModal: () => void;
  toggleSettingsModal: () => void;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  toggleAmbience: () => void;
  setAmbienceSettings: (settings: AmbienceSettings) => void;
  setSoundSettings: (settings: SoundSettings) => void;
  setCharacterSettings: (settings: CharacterSettings) => void;
  toggleAiPanel: () => void;
  setAiPanelMode: (mode: 'sidebar' | 'floating') => void;
  setActiveRightTab: (tab: RightPanelTab) => void;
  setRightPanelWidth: (width: number) => void;
  /** 右パネルを開いて指定タブに切り替える */
  openRightPanelTab: (tab: RightPanelTab) => void;
}

const initialAmbience = loadAmbienceSettings();

export const useUIStore = create<UIState>((set) => ({
  leftPanelVisible: true,
  rightPanelVisible: false,
  searchBarVisible: false,
  isTategaki: false,
  settings: DEFAULT_SETTINGS,
  proofreadSettings: DEFAULT_PROOFREAD_SETTINGS,
  theme: loadTheme(),
  editorViewMode: 'editor',
  analysisModalVisible: false,
  settingsModalVisible: false,
  ambienceEnabled: initialAmbience.enabled,
  ambienceSettings: initialAmbience.settings,
  soundSettings: loadSoundSettings(),
  characterSettings: loadCharacterSettings(),
  aiPanelVisible: false,
  aiPanelMode: 'sidebar',
  activeRightTab: 'ai' as RightPanelTab,
  rightPanelWidth: loadRightPanelWidth(),

  toggleLeftPanel: () =>
    set((s) => ({ leftPanelVisible: !s.leftPanelVisible })),
  toggleRightPanel: () =>
    set((s) => ({ rightPanelVisible: !s.rightPanelVisible })),
  toggleSearchBar: () =>
    set((s) => ({ searchBarVisible: !s.searchBarVisible })),
  toggleTategaki: () =>
    set((s) => ({ isTategaki: !s.isTategaki })),
  setSettings: (settings) => set({ settings }),
  setProofreadSettings: (proofreadSettings) => set({ proofreadSettings }),
  setEditorViewMode: (editorViewMode) => set({ editorViewMode }),
  toggleAnalysisModal: () =>
    set((s) => ({ analysisModalVisible: !s.analysisModalVisible })),
  toggleSettingsModal: () =>
    set((s) => ({ settingsModalVisible: !s.settingsModalVisible })),
  toggleTheme: () =>
    set((s) => {
      const next: ThemeMode = s.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('story-attic-theme', next); } catch { /* 無視 */ }
      return { theme: next };
    }),
  setTheme: (theme) => {
    try { localStorage.setItem('story-attic-theme', theme); } catch { /* 無視 */ }
    set({ theme });
  },
  toggleAmbience: () =>
    set((s) => {
      const next = !s.ambienceEnabled;
      saveAmbienceToStorage(next, s.ambienceSettings);
      return { ambienceEnabled: next };
    }),
  setAmbienceSettings: (ambienceSettings) =>
    set((s) => {
      saveAmbienceToStorage(s.ambienceEnabled, ambienceSettings);
      return { ambienceSettings };
    }),
  setSoundSettings: (soundSettings) => {
    saveSoundToStorage(soundSettings);
    set({ soundSettings });
  },
  setCharacterSettings: (characterSettings) => {
    saveCharacterToStorage(characterSettings);
    set({ characterSettings });
  },
  toggleAiPanel: () =>
    set((s) => ({ aiPanelVisible: !s.aiPanelVisible })),
  setAiPanelMode: (mode) => set({ aiPanelMode: mode }),
  setActiveRightTab: (tab) => set({ activeRightTab: tab }),
  setRightPanelWidth: (width) => {
    const clamped = Math.max(RIGHT_PANEL_MIN_WIDTH, Math.min(RIGHT_PANEL_MAX_WIDTH, width));
    saveRightPanelWidth(clamped);
    set({ rightPanelWidth: clamped });
  },
  openRightPanelTab: (tab) =>
    set({ rightPanelVisible: true, activeRightTab: tab }),
}));

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { ProjectSettings, ProofreadSettings } from '../types';
import { DEFAULT_SETTINGS, DEFAULT_PROOFREAD_SETTINGS } from '../types';
import { BGM_TRACKS } from '@/features/ambience/generators/bgmTracks';

/** エディタのビューモード */
export type EditorViewMode = 'editor' | 'diff' | 'proofread' | 'reactions' | 'dialogue' | 'preview' | 'dual';

/** プレビューのサブモード */
export type PreviewSubMode = 'manuscript' | 'smartphone';

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

/** タイピング音の種類 */
export type TypingSoundType = 'mechanical' | 'wooden' | 'soft' | 'none';

/** サウンド設定 */
export interface SoundSettings {
  enabled: boolean;
  masterVolume: number;    // 0 ~ 1
  typingType: TypingSoundType;
  typingVolume: number;    // 0 ~ 1
  bgmTrack: string | null; // BGMトラックID（null = オフ）
  bgmVolume: number;       // 0 ~ 1
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  enabled: false,
  masterVolume: 0.5,
  typingType: 'none',
  typingVolume: 0.3,
  bgmTrack: null,
  bgmVolume: 0.5,
};

/** 読者シミュレーターのペルソナ */
export type ReaderPersona = 'casual' | 'genre' | 'critical';

/** キャラクターウィジェット設定 */
export interface CharacterSettings {
  enabled: boolean;
  readerMode: boolean;
  readerPersona: ReaderPersona;
}

export const DEFAULT_CHARACTER_SETTINGS: CharacterSettings = {
  enabled: true,
  readerMode: false,
  readerPersona: 'casual',
};

/** 共鳴スコア（AI 4軸評価の結果） */
export interface ResonanceScore {
  tension: number;
  empathy: number;
  tempo: number;
  surprise: number;
  suggestions: string[];
}

/** 右パネルのアクティブタブ（AIは独立パネルに分離済み） */
export type RightPanelTab =
  | 'chapter' | 'character' | 'plot' | 'synopsis'
  | 'relationship' | 'glossary' | 'world' | 'foreshadowing' | 'memo' | 'info-gap';

/** 統合サイドパネルのアクティブタブ (目次 + 既存 RightPanelTab) */
export type SideTab = 'toc' | RightPanelTab;
const VALID_SIDE_TABS: SideTab[] = [
  'toc', 'chapter', 'character', 'plot', 'synopsis',
  'relationship', 'glossary', 'world', 'foreshadowing', 'memo', 'info-gap',
];

function loadActiveSideTab(): SideTab {
  try {
    const stored = localStorage.getItem('story-attic-active-side-tab');
    if (stored && VALID_SIDE_TABS.includes(stored as SideTab)) return stored as SideTab;
  } catch { /* 無視 */ }
  return 'toc';
}
function saveActiveSideTab(tab: SideTab) {
  try { localStorage.setItem('story-attic-active-side-tab', tab); } catch { /* 無視 */ }
}

function loadSidePanelVisible(): boolean {
  try {
    const stored = localStorage.getItem('story-attic-side-panel-visible');
    if (stored !== null) return stored === 'true';
  } catch { /* 無視 */ }
  return true;
}
function saveSidePanelVisible(v: boolean) {
  try { localStorage.setItem('story-attic-side-panel-visible', String(v)); } catch { /* 無視 */ }
}

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

function loadAiPanelMode(): 'float' | 'sidebar' {
  try {
    const stored = localStorage.getItem('story-attic-ai-panel-mode');
    if (stored === 'sidebar') return 'sidebar';
  } catch { /* 無視 */ }
  return 'float';
}
function saveAiPanelMode(mode: 'float' | 'sidebar') {
  try { localStorage.setItem('story-attic-ai-panel-mode', mode); } catch { /* 無視 */ }
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
      const EFFECT_TYPES: EffectType[] = ['rain', 'snow', 'sakura'];
      const DENSITIES: ParticleDensity[] = ['sparse', 'normal', 'dense'];
      const s = parsed.settings ?? {};
      return {
        enabled: !!parsed.enabled,
        settings: {
          effectType: EFFECT_TYPES.includes(s.effectType) ? s.effectType as EffectType : DEFAULT_AMBIENCE_SETTINGS.effectType,
          density: DENSITIES.includes(s.density) ? s.density as ParticleDensity : DEFAULT_AMBIENCE_SETTINGS.density,
          speed: typeof s.speed === 'number' && Number.isFinite(s.speed) ? Math.max(1, Math.min(10, s.speed)) : DEFAULT_AMBIENCE_SETTINGS.speed,
          angle: typeof s.angle === 'number' && Number.isFinite(s.angle) ? Math.max(-30, Math.min(30, s.angle)) : DEFAULT_AMBIENCE_SETTINGS.angle,
          opacity: typeof s.opacity === 'number' && Number.isFinite(s.opacity) ? Math.max(0.1, Math.min(0.8, s.opacity)) : DEFAULT_AMBIENCE_SETTINGS.opacity,
        },
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
      const parsed = JSON.parse(stored);
      const PERSONAS: ReaderPersona[] = ['casual', 'genre', 'critical'];
      return {
        enabled: !!parsed.enabled,
        readerMode: !!parsed.readerMode,
        readerPersona: PERSONAS.includes(parsed.readerPersona) ? parsed.readerPersona as ReaderPersona : DEFAULT_CHARACTER_SETTINGS.readerPersona,
      };
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
      const parsed = JSON.parse(stored);
      const TYPING_TYPES: TypingSoundType[] = ['mechanical', 'wooden', 'soft', 'none'];
      const validBgm = typeof parsed.bgmTrack === 'string' && BGM_TRACKS.some((t) => t.id === parsed.bgmTrack);
      return {
        enabled: !!parsed.enabled,
        masterVolume: typeof parsed.masterVolume === 'number' && Number.isFinite(parsed.masterVolume)
          ? Math.max(0, Math.min(1, parsed.masterVolume))
          : DEFAULT_SOUND_SETTINGS.masterVolume,
        typingType: TYPING_TYPES.includes(parsed.typingType) ? parsed.typingType as TypingSoundType : DEFAULT_SOUND_SETTINGS.typingType,
        typingVolume: typeof parsed.typingVolume === 'number' && Number.isFinite(parsed.typingVolume)
          ? Math.max(0, Math.min(1, parsed.typingVolume))
          : DEFAULT_SOUND_SETTINGS.typingVolume,
        bgmTrack: validBgm ? (parsed.bgmTrack as string) : DEFAULT_SOUND_SETTINGS.bgmTrack,
        bgmVolume: typeof parsed.bgmVolume === 'number' && Number.isFinite(parsed.bgmVolume)
          ? Math.max(0, Math.min(1, parsed.bgmVolume))
          : DEFAULT_SOUND_SETTINGS.bgmVolume,
      };
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

/** 今日の執筆合計秒数をlocalStorageから復元（別日付なら0にリセット） */
function loadTodaySession(): { sec: number; date: string } {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const stored = localStorage.getItem('story-attic-today-session');
    if (stored) {
      const parsed = JSON.parse(stored) as { date: string; sec: number };
      if (parsed.date === today) return { sec: Number(parsed.sec) || 0, date: today };
    }
  } catch { /* 無視 */ }
  return { sec: 0, date: today };
}

/** 今日の執筆合計秒数をlocalStorageに保存 */
function saveTodaySessionToStorage(date: string, sec: number) {
  try { localStorage.setItem('story-attic-today-session', JSON.stringify({ date, sec })); } catch { /* 無視 */ }
}

/** 今日の執筆量トラッキング（エピソードごとの当日基準値と現在値） */
export interface TodayWrittenState {
  date: string;
  byEpisode: Record<string, { base: number; cur: number }>;
}

/** エピソードごとの差分を合算して「今日書いた字数」を返す（負値は0に丸める） */
export function sumTodayWritten(byEpisode: TodayWrittenState['byEpisode']): number {
  let total = 0;
  for (const v of Object.values(byEpisode)) total += v.cur - v.base;
  return Math.max(0, total);
}

/** 今日の執筆量をlocalStorageから復元（別日付なら空にリセット） */
function loadTodayWritten(): TodayWrittenState {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const stored = localStorage.getItem('story-attic-today-written');
    if (stored) {
      const parsed = JSON.parse(stored) as TodayWrittenState;
      if (parsed.date === today && parsed.byEpisode && typeof parsed.byEpisode === 'object') {
        return { date: today, byEpisode: parsed.byEpisode };
      }
    }
  } catch { /* 無視 */ }
  return { date: today, byEpisode: {} };
}

/** 今日の執筆量をlocalStorageに保存 */
function saveTodayWrittenToStorage(state: TodayWrittenState) {
  try { localStorage.setItem('story-attic-today-written', JSON.stringify(state)); } catch { /* 無視 */ }
}

/** セッション終了サマリー（タイマー終了時の達成フィードバック用） */
export interface SessionSummary {
  /** セッション中に書いた字数 */
  chars: number;
  /** セッションの経過秒数 */
  sec: number;
}

/** 執筆集中モード（タイプライター/段落フォーカス）の復元 */
function loadFocusModes(): { typewriter: boolean; paragraphFocus: boolean } {
  try {
    const stored = localStorage.getItem('story-attic-focus-modes');
    if (stored) {
      const parsed = JSON.parse(stored);
      return { typewriter: !!parsed.typewriter, paragraphFocus: !!parsed.paragraphFocus };
    }
  } catch { /* 無視 */ }
  return { typewriter: false, paragraphFocus: false };
}

/** 執筆集中モードの保存 */
function saveFocusModesToStorage(typewriter: boolean, paragraphFocus: boolean) {
  try { localStorage.setItem('story-attic-focus-modes', JSON.stringify({ typewriter, paragraphFocus })); } catch { /* 無視 */ }
}

interface UIState {
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
  /** 設定モーダルを開く際の初期タブ（適用後 null に戻す） */
  settingsModalInitialTab: string | null;

  /** パーティクル演出 */
  ambienceEnabled: boolean;
  ambienceSettings: AmbienceSettings;

  /** サウンド設定 */
  soundSettings: SoundSettings;

  /** キャラクターウィジェット設定 */
  characterSettings: CharacterSettings;

  /** AIパネル表示（フローティングウィンドウ） */
  aiPanelVisible: boolean;
  /** AIパネルモード */
  aiPanelMode: 'float' | 'sidebar';

  /** サイドパネルの幅 (px) — 旧 rightPanelWidth から継承 */
  rightPanelWidth: number;

  /** 執筆支援モーダル表示 */
  writingSupportModalVisible: boolean;

  /** AI マニュアルモーダル表示 */
  aiManualVisible: boolean;

  /** 執筆タイマー状態 */
  timerRunning: boolean;
  timerRemaining: number;   // 残り秒数
  timerTotal: number;       // 設定秒数

  /** 目標文字数（null = 未設定） */
  dailyGoal: number | null;

  /** プレビューのサブモード（原稿用紙 or スマートフォン） */
  previewSubMode: PreviewSubMode;

  /** コマンドパレット表示 */
  commandPaletteVisible: boolean;
  toggleCommandPalette: () => void;

  /** 雰囲気ポップオーバー表示 (演出/サウンド/ゴースト統合) */
  ambiencePopoverVisible: boolean;
  toggleAmbiencePopover: () => void;

  /** 統合サイドパネル */
  sidePanelVisible: boolean;
  activeSideTab: SideTab;
  toggleSidePanel: () => void;
  setActiveSideTab: (tab: SideTab) => void;
  openSidePanelTab: (tab: SideTab) => void;

  toggleSearchBar: () => void;
  toggleTategaki: () => void;
  setSettings: (settings: ProjectSettings) => void;
  setProofreadSettings: (settings: ProofreadSettings) => void;
  setEditorViewMode: (mode: EditorViewMode) => void;
  toggleAnalysisModal: () => void;
  toggleSettingsModal: () => void;
  /** 指定タブで設定モーダルを開く */
  openSettingsModal: (tab?: string) => void;
  /** 設定モーダルの初期タブ指定をクリアする */
  clearSettingsModalInitialTab: () => void;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  toggleAmbience: () => void;
  setAmbienceSettings: (settings: AmbienceSettings) => void;
  setSoundSettings: (settings: SoundSettings) => void;
  setCharacterSettings: (settings: CharacterSettings) => void;
  toggleAiPanel: () => void;
  toggleAiPanelMode: () => void;
  setRightPanelWidth: (width: number) => void;
  toggleWritingSupportModal: () => void;
  toggleAiManual: () => void;

  /** タイマー操作 */
  startTimer: (minutes: number) => void;
  stopTimer: () => void;
  tickTimer: () => void;

  /** パッシブ執筆追跡 */
  passiveSessionSec: number;     // 未フラッシュのセッション秒数
  todayTotalSec: number;         // 今日の確定済み合計秒数（localStorage永続化）
  todayDate: string;             // todayTotalSec に対応する日付 YYYY-MM-DD
  incrementPassiveSession: (deltaSec: number) => void;
  flushPassiveSession: (projectId: string, charCount: number) => Promise<void>;
  resetTodayIfNeeded: () => void;

  /** 今日の執筆量（エピソード横断・基準値との差分で計測） */
  todayWritten: TodayWrittenState;
  todayWrittenChars: number;
  updateTodayWritten: (episodeId: string, chars: number) => void;

  /** タイマー開始時点の「今日書いた字数」（セッション執筆量の算出用） */
  sessionStartWritten: number | null;
  /** セッション終了サマリー（nullで非表示） */
  sessionSummary: SessionSummary | null;
  setSessionSummary: (summary: SessionSummary) => void;
  clearSessionSummary: () => void;

  /** タイプライターモード（カーソル行を常に中央へ） */
  typewriterMode: boolean;
  toggleTypewriterMode: () => void;
  /** 段落フォーカスモード（編集中の段落以外を淡色化） */
  paragraphFocusMode: boolean;
  toggleParagraphFocusMode: () => void;
  /** 集中モード（ヘッダー/ツールバー/ステータスバー/パネルを隠す没入モード。セッション限り） */
  zenMode: boolean;
  toggleZenMode: () => void;

  /** 没入読書モード（全画面の書籍風ビュー。セッション限り） */
  readingMode: boolean;
  toggleReadingMode: () => void;
  closeReadingMode: () => void;

  /** 目標文字数を設定（0やnullで解除） */
  setDailyGoal: (goal: number | null) => void;

  /** プレビューのサブモードを切替 */
  setPreviewSubMode: (mode: PreviewSubMode) => void;

  /** エピソードIDごとの除外済み校正指摘キー */
  dismissedIssuesByEpisode: Record<string, string[]>;
  addDismissedIssueKey: (episodeId: string, key: string) => void;
  removeDismissedIssueKey: (episodeId: string, key: string) => void;

  /** エピソードIDごとの共鳴スコア（セッション内メモリ保持・localStorage非永続） */
  resonanceScoresByEpisode: Record<string, ResonanceScore>;
  setResonanceScore: (episodeId: string, score: ResonanceScore) => void;
}

const initialAmbience = loadAmbienceSettings();

const initialTodaySession = loadTodaySession();

const initialTodayWritten = loadTodayWritten();

const initialFocusModes = loadFocusModes();

export const useUIStore = create<UIState>((set, get) => ({
  searchBarVisible: false,
  isTategaki: false,
  settings: DEFAULT_SETTINGS,
  proofreadSettings: DEFAULT_PROOFREAD_SETTINGS,
  theme: loadTheme(),
  editorViewMode: 'editor',
  analysisModalVisible: false,
  settingsModalVisible: false,
  settingsModalInitialTab: null,
  ambienceEnabled: initialAmbience.enabled,
  ambienceSettings: initialAmbience.settings,
  soundSettings: loadSoundSettings(),
  characterSettings: loadCharacterSettings(),
  aiPanelVisible: false,
  aiPanelMode: loadAiPanelMode(),
  rightPanelWidth: loadRightPanelWidth(),
  writingSupportModalVisible: false,
  aiManualVisible: false,
  timerRunning: false,
  timerRemaining: 0,
  timerTotal: 0,
  passiveSessionSec: 0,
  todayTotalSec: initialTodaySession.sec,
  todayDate: initialTodaySession.date,
  todayWritten: initialTodayWritten,
  todayWrittenChars: sumTodayWritten(initialTodayWritten.byEpisode),
  sessionStartWritten: null,
  sessionSummary: null,
  typewriterMode: initialFocusModes.typewriter,
  paragraphFocusMode: initialFocusModes.paragraphFocus,
  zenMode: false,
  readingMode: false,
  previewSubMode: 'manuscript' as PreviewSubMode,
  commandPaletteVisible: false,
  ambiencePopoverVisible: false,
  sidePanelVisible: loadSidePanelVisible(),
  activeSideTab: loadActiveSideTab(),
  dailyGoal: (() => {
    try {
      const v = Number(localStorage.getItem('story-attic-goal-chars'));
      return v > 0 ? v : null;
    } catch { return null; }
  })(),

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
  openSettingsModal: (tab) =>
    set({ settingsModalVisible: true, settingsModalInitialTab: tab ?? null }),
  clearSettingsModalInitialTab: () =>
    set({ settingsModalInitialTab: null }),
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
  toggleAiPanelMode: () =>
    set((s) => {
      const next = s.aiPanelMode === 'float' ? 'sidebar' : 'float';
      saveAiPanelMode(next);
      return { aiPanelMode: next };
    }),
  setRightPanelWidth: (width) => {
    const clamped = Math.max(RIGHT_PANEL_MIN_WIDTH, Math.min(RIGHT_PANEL_MAX_WIDTH, width));
    saveRightPanelWidth(clamped);
    set({ rightPanelWidth: clamped });
  },
  toggleWritingSupportModal: () =>
    set((s) => ({ writingSupportModalVisible: !s.writingSupportModalVisible })),
  toggleAiManual: () =>
    set((s) => ({ aiManualVisible: !s.aiManualVisible })),

  startTimer: (minutes) => {
    const totalSec = minutes * 60;
    // セッション執筆量の基準として開始時点の「今日書いた字数」を記録
    set({ timerRunning: true, timerRemaining: totalSec, timerTotal: totalSec, sessionStartWritten: get().todayWrittenChars });
  },
  stopTimer: () => {
    set({ timerRunning: false, timerRemaining: 0, timerTotal: 0 });
  },
  tickTimer: () =>
    set((s) => {
      if (!s.timerRunning || s.timerRemaining <= 0) return s;
      const next = s.timerRemaining - 1;
      if (next <= 0) {
        return { timerRemaining: 0, timerRunning: false };
      }
      return { timerRemaining: next };
    }),

  incrementPassiveSession: (deltaSec) =>
    set((s) => ({ passiveSessionSec: s.passiveSessionSec + deltaSec })),

  flushPassiveSession: async (projectId, charCount) => {
    const { passiveSessionSec, todayTotalSec } = get();
    if (passiveSessionSec <= 0 || !projectId) return;
    const today = new Date().toISOString().slice(0, 10);
    const newTotal = todayTotalSec + passiveSessionSec;
    set({ passiveSessionSec: 0, todayTotalSec: newTotal, todayDate: today });
    saveTodaySessionToStorage(today, newTotal);
    await invoke('append_diary_session', {
      projectId, date: today, charCount, deltaSec: passiveSessionSec,
    }).catch(() => { /* 無視 */ });
  },

  resetTodayIfNeeded: () => {
    const today = new Date().toISOString().slice(0, 10);
    const { todayDate } = get();
    if (todayDate !== today) {
      set({ todayTotalSec: 0, todayDate: today, passiveSessionSec: 0 });
      saveTodaySessionToStorage(today, 0);
    }
  },

  updateTodayWritten: (episodeId, chars) =>
    set((s) => {
      const today = new Date().toISOString().slice(0, 10);
      // 日付が変わっていたら基準値をリセット
      const byEpisode = s.todayWritten.date === today ? { ...s.todayWritten.byEpisode } : {};
      const prev = byEpisode[episodeId];
      byEpisode[episodeId] = prev ? { ...prev, cur: chars } : { base: chars, cur: chars };
      const next: TodayWrittenState = { date: today, byEpisode };
      saveTodayWrittenToStorage(next);
      return { todayWritten: next, todayWrittenChars: sumTodayWritten(byEpisode) };
    }),

  setSessionSummary: (sessionSummary) => set({ sessionSummary }),
  clearSessionSummary: () => set({ sessionSummary: null }),

  toggleTypewriterMode: () =>
    set((s) => {
      const next = !s.typewriterMode;
      saveFocusModesToStorage(next, s.paragraphFocusMode);
      return { typewriterMode: next };
    }),
  toggleParagraphFocusMode: () =>
    set((s) => {
      const next = !s.paragraphFocusMode;
      saveFocusModesToStorage(s.typewriterMode, next);
      return { paragraphFocusMode: next };
    }),

  toggleZenMode: () =>
    set((s) => ({ zenMode: !s.zenMode })),

  toggleReadingMode: () =>
    set((s) => ({ readingMode: !s.readingMode })),
  closeReadingMode: () => set({ readingMode: false }),

  setPreviewSubMode: (previewSubMode) => set({ previewSubMode }),

  toggleCommandPalette: () =>
    set((s) => ({ commandPaletteVisible: !s.commandPaletteVisible })),

  toggleAmbiencePopover: () =>
    set((s) => ({ ambiencePopoverVisible: !s.ambiencePopoverVisible })),

  toggleSidePanel: () =>
    set((s) => {
      const next = !s.sidePanelVisible;
      saveSidePanelVisible(next);
      return { sidePanelVisible: next };
    }),
  setActiveSideTab: (tab) => {
    const validTab: SideTab = VALID_SIDE_TABS.includes(tab) ? tab : 'toc';
    saveActiveSideTab(validTab);
    set({ activeSideTab: validTab });
  },
  openSidePanelTab: (tab) => {
    const validTab: SideTab = VALID_SIDE_TABS.includes(tab) ? tab : 'toc';
    saveActiveSideTab(validTab);
    saveSidePanelVisible(true);
    set({ sidePanelVisible: true, activeSideTab: validTab });
  },

  dismissedIssuesByEpisode: (() => {
    try {
      const stored = localStorage.getItem('story-attic-dismissed-issues');
      return stored ? (JSON.parse(stored) as Record<string, string[]>) : {};
    } catch { return {}; }
  })(),
  addDismissedIssueKey: (episodeId, key) =>
    set((s) => {
      const prev = s.dismissedIssuesByEpisode[episodeId] ?? [];
      if (prev.includes(key)) return s;
      const next = { ...s.dismissedIssuesByEpisode, [episodeId]: [...prev, key] };
      try { localStorage.setItem('story-attic-dismissed-issues', JSON.stringify(next)); } catch { /* 無視 */ }
      return { dismissedIssuesByEpisode: next };
    }),
  removeDismissedIssueKey: (episodeId, key) =>
    set((s) => {
      const prev = s.dismissedIssuesByEpisode[episodeId] ?? [];
      const next = { ...s.dismissedIssuesByEpisode, [episodeId]: prev.filter((k) => k !== key) };
      try { localStorage.setItem('story-attic-dismissed-issues', JSON.stringify(next)); } catch { /* 無視 */ }
      return { dismissedIssuesByEpisode: next };
    }),

  resonanceScoresByEpisode: {},
  setResonanceScore: (episodeId, score) =>
    set((s) => ({
      resonanceScoresByEpisode: { ...s.resonanceScoresByEpisode, [episodeId]: score },
    })),

  setDailyGoal: (goal) => {
    const value = goal && goal > 0 ? goal : null;
    try {
      if (value) {
        localStorage.setItem('story-attic-goal-chars', String(value));
      } else {
        localStorage.removeItem('story-attic-goal-chars');
      }
    } catch { /* 無視 */ }
    set({ dailyGoal: value });
  },
}));

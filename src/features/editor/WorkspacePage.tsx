import { useEffect } from 'react';
import { useAppStore } from '@/shared/stores/appStore';
import { useProjectStore } from '@/shared/stores/projectStore';
import { useEditorStore } from '@/shared/stores/editorStore';
import { useUIStore } from '@/shared/stores/uiStore';
import { useAutoSave } from '@/shared/hooks/useAutoSave';
import { useHistorySnapshot } from '@/shared/hooks/useHistorySnapshot';
import { useSound } from '@/shared/hooks/useSound';
import { usePassiveSessionTracker } from '@/features/writing-support/usePassiveSessionTracker';
import { useTodayWrittenTracker } from '@/features/writing-support/useTodayWrittenTracker';
import { SessionSummaryCard } from '@/features/writing-support/SessionSummaryCard';
import { ResumeCard } from '@/features/writing-support/ResumeCard';
import { WorkspaceHeader } from './components/WorkspaceHeader';
import { EditorArea } from './components/EditorArea';
import { SidePanel } from './components/SidePanel';
import { ParticleEffect } from '@/features/ambience/ParticleEffect';
import { CharacterWidget } from '@/features/ambience/CharacterWidget';
import { AiPanel } from '@/features/ai/AiPanel';
import { AnalysisModal } from '@/features/analysis/AnalysisModal';
import { SettingsModal } from '@/features/settings/SettingsModal';
import { WritingSupportModal } from '@/features/writing-support/WritingSupportModal';
import { AiManualModal } from '@/features/ai/AiManualModal';
import { CommandPalette } from './components/CommandPalette';
import { AmbiencePopover } from '@/features/ambience/AmbiencePopover';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';

export function WorkspacePage() {
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const { openProject, currentProject } = useProjectStore();
  const { loadChapterTree, clearCurrentEpisode, save, saveSecondary } = useEditorStore();
  const {
    aiPanelVisible, aiPanelMode,
    setSettings, toggleAiPanel, toggleSidePanel, setEditorViewMode, editorViewMode,
    timerRunning, startTimer, stopTimer, toggleWritingSupportModal,
    analysisModalVisible, settingsModalVisible, writingSupportModalVisible, aiManualVisible,
    toggleAnalysisModal, toggleSettingsModal, toggleAiManual,
    toggleCommandPalette, commandPaletteVisible,
    setActiveSideTab,
    ambiencePopoverVisible, toggleAmbiencePopover,
    zenMode, toggleZenMode,
  } = useUIStore();

  // 自動保存フック
  useAutoSave();
  // 履歴スナップショット（5分間隔）
  useHistorySnapshot();
  // サウンド管理フック
  useSound();
  // パッシブ執筆追跡フック
  const currentEpisodeForTracker = useEditorStore((s) => s.currentEpisode);
  usePassiveSessionTracker(currentProjectId, currentEpisodeForTracker?.charCount ?? 0);
  // 今日の執筆量トラッカー（日次目標・セッションサマリー・再開情報の基礎データ）
  useTodayWrittenTracker(currentProjectId);

  useEffect(() => {
    if (currentProjectId) {
      clearCurrentEpisode();
      void openProject(currentProjectId);
      void loadChapterTree(currentProjectId);
    }
  }, [currentProjectId, openProject, loadChapterTree, clearCurrentEpisode]);

  // グローバルキーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // Ctrl+Shift+A: AIパネル開閉
      if (ctrl && shift && e.key === 'A') {
        e.preventDefault();
        toggleAiPanel();
        return;
      }
      // Ctrl+Shift+D: デュアルビュー切替
      if (ctrl && shift && e.key === 'D') {
        e.preventDefault();
        setEditorViewMode(editorViewMode === 'dual' ? 'editor' : 'dual');
        return;
      }
      // Ctrl+Shift+P: プレビュー切替
      if (ctrl && shift && e.key === 'P') {
        e.preventDefault();
        setEditorViewMode(editorViewMode === 'preview' ? 'editor' : 'preview');
        return;
      }
      // Ctrl+Shift+L: 台詞ビュー切替
      if (ctrl && shift && e.key === 'L') {
        e.preventDefault();
        setEditorViewMode(editorViewMode === 'dialogue' ? 'editor' : 'dialogue');
        return;
      }
      // Ctrl+T: タイマー開始/停止
      if (ctrl && !shift && e.key === 't') {
        e.preventDefault();
        if (timerRunning) {
          stopTimer();
        } else {
          startTimer(25);
        }
        return;
      }
      // Ctrl+Shift+R: サイドパネル開閉
      if (ctrl && shift && e.key === 'R') {
        e.preventDefault();
        toggleSidePanel();
        return;
      }
      // Ctrl+Shift+F: 集中モード切替
      if (ctrl && shift && e.key === 'F') {
        e.preventDefault();
        toggleZenMode();
        return;
      }
      // Ctrl+P: コマンドパレット
      if (ctrl && !shift && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        toggleCommandPalette();
        return;
      }
      // Ctrl+1..9, Ctrl+0: サイドパネルタブ切替
      if (ctrl && !shift && !e.altKey && ['1','2','3','4','5','6','7','8','9','0'].includes(e.key)) {
        e.preventDefault();
        const tabs = ['toc','chapter','character','plot','synopsis','relationship','glossary','world','foreshadowing','memo'] as const;
        const idx = e.key === '0' ? 9 : Number(e.key) - 1;
        setActiveSideTab(tabs[idx]);
        return;
      }
      // Ctrl+S: 保存（プライマリ＋セカンダリ両方）
      if (ctrl && !shift && e.key === 's') {
        e.preventDefault();
        void save();
        void saveSecondary();
        return;
      }
      // Escape: モーダル/フローティングパネル閉じ
      if (e.key === 'Escape') {
        if (commandPaletteVisible) { toggleCommandPalette(); return; }
        if (aiManualVisible) { toggleAiManual(); return; }
        if (analysisModalVisible) { toggleAnalysisModal(); return; }
        if (settingsModalVisible) { toggleSettingsModal(); return; }
        if (writingSupportModalVisible) { toggleWritingSupportModal(); return; }
        if (aiPanelVisible) { toggleAiPanel(); return; }
        if (zenMode) { toggleZenMode(); return; }
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    toggleAiPanel, toggleSidePanel, setEditorViewMode, editorViewMode,
    timerRunning, startTimer, stopTimer, save, saveSecondary,
    aiPanelVisible, analysisModalVisible, settingsModalVisible, writingSupportModalVisible, aiManualVisible,
    toggleAnalysisModal, toggleSettingsModal, toggleWritingSupportModal, toggleAiManual,
    toggleCommandPalette, commandPaletteVisible, setActiveSideTab,
    zenMode, toggleZenMode,
  ]);

  // プロジェクトの設定をUIストアに反映
  useEffect(() => {
    if (currentProject?.settings && typeof currentProject.settings === 'object') {
      const s = currentProject.settings as unknown as Record<string, unknown>;
      // デフォルト値とマージ（DBに保存されていない新しい設定キーもカバー）
      setSettings({
        auto_indent: typeof s.auto_indent === 'boolean' ? s.auto_indent : true,
        auto_save: typeof s.auto_save === 'boolean' ? s.auto_save : true,
        auto_save_interval_sec: typeof s.auto_save_interval_sec === 'number' ? s.auto_save_interval_sec : 60,
        show_char_count: typeof s.show_char_count === 'boolean' ? s.show_char_count : true,
        chars_per_line: typeof s.chars_per_line === 'number' ? s.chars_per_line : 40,
        lines_per_page: typeof s.lines_per_page === 'number' ? s.lines_per_page : 20,
        editor_font: typeof s.editor_font === 'string' ? s.editor_font : '游明朝',
        editor_font_size: typeof s.editor_font_size === 'number' ? s.editor_font_size : 16,
        editor_max_width: typeof s.editor_max_width === 'number' ? s.editor_max_width : 860,
      });
    }
  }, [currentProject, setSettings]);

  return (
    <div className="flex flex-col h-full ambient-noise" style={{ background: 'var(--bg)' }}>
      {/* 集中モード中はヘッダー・サイドパネルを隠してエディタだけにする */}
      {!zenMode && <WorkspaceHeader />}
      <div className="flex flex-1 overflow-hidden">
        {/* 統合サイドパネル (アクティビティバー + コンテンツ) */}
        {!zenMode && (
          <ErrorBoundary variant="panel" name="サイドパネル">
            <SidePanel />
          </ErrorBoundary>
        )}

        {/* エディタエリア（可変） */}
        <div className="flex-1 overflow-hidden relative">
          <ParticleEffect />
          <EditorArea />
        </div>

        {/* AIパネル — サイドバーモード */}
        {aiPanelVisible && aiPanelMode === 'sidebar' && (
          <ErrorBoundary variant="panel" name="AIパネル">
            <AiPanel />
          </ErrorBoundary>
        )}
      </div>

      {/* AIパネル — フローティングモード */}
      {aiPanelVisible && aiPanelMode === 'float' && (
        <ErrorBoundary variant="panel" name="AIパネル">
          <AiPanel />
        </ErrorBoundary>
      )}

      {/* キャラクターウィジェット */}
      <CharacterWidget />

      {/* 「おかえり」再開カード */}
      <ResumeCard />

      {/* セッション終了サマリー */}
      <SessionSummaryCard />

      {/* コマンドパレット */}
      <CommandPalette />

      {/* 雰囲気ポップオーバー (中央モーダル) */}
      {ambiencePopoverVisible && (
        <div
          className="modal-overlay"
          style={{ zIndex: 150 }}
          onClick={toggleAmbiencePopover}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <AmbiencePopover />
          </div>
        </div>
      )}

      {/* モーダル */}
      <AnalysisModal />
      <SettingsModal />
      <WritingSupportModal />
      <AiManualModal />
    </div>
  );
}

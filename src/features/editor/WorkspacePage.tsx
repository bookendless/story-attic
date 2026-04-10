import { useEffect } from 'react';
import { useAppStore } from '@/shared/stores/appStore';
import { useProjectStore } from '@/shared/stores/projectStore';
import { useEditorStore } from '@/shared/stores/editorStore';
import { useUIStore } from '@/shared/stores/uiStore';
import { useAutoSave } from '@/shared/hooks/useAutoSave';
import { useSound } from '@/shared/hooks/useSound';
import { WorkspaceHeader } from './components/WorkspaceHeader';
import { LeftPanel } from './components/LeftPanel';
import { EditorArea } from './components/EditorArea';
import { RightPanel } from './components/RightPanel';
import { ParticleEffect } from '@/features/ambience/ParticleEffect';
import { CharacterWidget } from '@/features/ambience/CharacterWidget';
import { AiPanel } from '@/features/ai/AiPanel';
import { AnalysisModal } from '@/features/analysis/AnalysisModal';
import { SettingsModal } from '@/features/settings/SettingsModal';
import { WritingSupportModal } from '@/features/writing-support/WritingSupportModal';

export function WorkspacePage() {
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const { openProject, currentProject } = useProjectStore();
  const { loadChapterTree, save, saveSecondary } = useEditorStore();
  const {
    leftPanelVisible, rightPanelVisible, rightPanelWidth, aiPanelVisible,
    setSettings, toggleAiPanel, toggleRightPanel, setEditorViewMode, editorViewMode,
    timerRunning, startTimer, stopTimer, toggleWritingSupportModal,
    analysisModalVisible, settingsModalVisible, writingSupportModalVisible,
    toggleAnalysisModal, toggleSettingsModal,
  } = useUIStore();

  // 自動保存フック
  useAutoSave();
  // サウンド管理フック
  useSound();

  useEffect(() => {
    if (currentProjectId) {
      openProject(currentProjectId);
      loadChapterTree(currentProjectId);
    }
  }, [currentProjectId, openProject, loadChapterTree]);

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
      // Ctrl+Shift+R: 右パネル開閉
      if (ctrl && shift && e.key === 'R') {
        e.preventDefault();
        toggleRightPanel();
        return;
      }
      // Ctrl+S: 保存（プライマリ＋セカンダリ両方）
      if (ctrl && !shift && e.key === 's') {
        e.preventDefault();
        save();
        saveSecondary();
        return;
      }
      // Escape: モーダル/フローティングパネル閉じ
      if (e.key === 'Escape') {
        if (analysisModalVisible) { toggleAnalysisModal(); return; }
        if (settingsModalVisible) { toggleSettingsModal(); return; }
        if (writingSupportModalVisible) { toggleWritingSupportModal(); return; }
        if (aiPanelVisible) { toggleAiPanel(); return; }
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    toggleAiPanel, toggleRightPanel, setEditorViewMode, editorViewMode,
    timerRunning, startTimer, stopTimer, save, saveSecondary,
    aiPanelVisible, analysisModalVisible, settingsModalVisible, writingSupportModalVisible,
    toggleAnalysisModal, toggleSettingsModal, toggleWritingSupportModal,
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
      <WorkspaceHeader />
      <div className="flex flex-1 overflow-hidden">
        {/* 左パネル（220px）*/}
        <div
          className="flex-shrink-0 overflow-hidden transition-all duration-200 ease-out"
          style={{ width: leftPanelVisible ? '220px' : '0px' }}
        >
          <LeftPanel />
        </div>

        {/* エディタエリア（可変） */}
        <div className="flex-1 overflow-hidden relative">
          <ParticleEffect />
          <EditorArea />
        </div>

        {/* 右パネル（タブ切替式） */}
        <div
          className="flex-shrink-0 overflow-hidden transition-all duration-200 ease-out"
          style={{ width: rightPanelVisible ? `${rightPanelWidth}px` : '0px' }}
        >
          <RightPanel />
        </div>
      </div>

      {/* AI チャットパネル（フローティング） */}
      {aiPanelVisible && <AiPanel />}

      {/* キャラクターウィジェット */}
      <CharacterWidget />

      {/* モーダル */}
      <AnalysisModal />
      <SettingsModal />
      <WritingSupportModal />
    </div>
  );
}

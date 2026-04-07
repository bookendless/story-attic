import { useState } from 'react';
import { useAppStore } from '@/shared/stores/appStore';
import { useProjectStore } from '@/shared/stores/projectStore';
import { useEditorStore } from '@/shared/stores/editorStore';
import { useUIStore } from '@/shared/stores/uiStore';
import { ExportMenu } from './ExportMenu';
import { AmbiencePopover } from '@/features/ambience/AmbiencePopover';
import {
  IconHome,
  IconSave,
  IconSearch,
  IconAnalysis,
  IconProofread,
  IconDiff,
  IconTategaki,
  IconSettings,
  IconSun,
  IconMoon,
  IconRain,
  IconSnow,
  IconSakura,
  IconSound,
  IconSoundOff,
  IconGhost,
  IconAi,
} from '@/shared/components/Icons';

/** アイコンボタン（ツールチップ付き） */
function HeaderButton({
  icon,
  label,
  shortLabel,
  shortcut,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  shortLabel?: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`header-icon-btn flex-col ${active ? 'active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 'auto',
        minHeight: '44px',
        minWidth: '44px',
        padding: '6px 4px 4px',
        gap: '2px',
        justifyContent: 'center'
      }}
    >
      <div className="flex items-center justify-center">
        {icon}
      </div>
      <span style={{ fontSize: '10px', lineHeight: 1, opacity: active ? 1 : 0.8, transform: 'scale(0.95)' }}>
        {shortLabel || label}
      </span>
      <span className="tooltip">
        {label}
        {shortcut && (
          <span style={{ opacity: 0.5, marginLeft: '6px' }}>{shortcut}</span>
        )}
      </span>
    </button>
  );
}

export function WorkspaceHeader() {
  const navigateTo = useAppStore((s) => s.navigateTo);
  const currentProject = useProjectStore((s) => s.currentProject);
  const { currentEpisode, isDirty, save, isSaving } = useEditorStore();
  const {
    toggleSearchBar,
    toggleTategaki,
    isTategaki,
    searchBarVisible,
    editorViewMode,
    setEditorViewMode,
    toggleAnalysisModal,
    toggleSettingsModal,
    theme,
    toggleTheme,
    ambienceEnabled,
    ambienceSettings,
    toggleAmbience,
    soundSettings,
    setSoundSettings,
    characterSettings,
    setCharacterSettings,
    aiPanelVisible,
    toggleAiPanel,
  } = useUIStore();
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [showAmbiencePopover, setShowAmbiencePopover] = useState(false);
  const updateProject = useProjectStore((s) => s.updateProject);

  const handleHomeClick = () => {
    if (isDirty) {
      setShowUnsavedWarning(true);
    } else {
      navigateTo('home');
    }
  };

  const handleSaveAndGoHome = async () => {
    await save();
    navigateTo('home');
  };

  const handleProjectTitleClick = () => {
    if (!currentProject) return;
    setTitleInput(currentProject.title);
    setIsEditingTitle(true);
  };

  const handleTitleSubmit = async () => {
    if (!currentProject || !titleInput.trim()) {
      setIsEditingTitle(false);
      return;
    }
    await updateProject(currentProject.id, { title: titleInput.trim() });
    setIsEditingTitle(false);
  };

  const hasEpisode = !!currentEpisode;

  /** 演出アイコン（現在の演出タイプに応じて切替） */
  const ambienceIcon =
    ambienceSettings.effectType === 'snow' ? <IconSnow size={15} /> :
    ambienceSettings.effectType === 'sakura' ? <IconSakura size={15} /> :
    <IconRain size={15} />;

  /** 演出 or サウンドのいずれかがアクティブ */
  const ambienceOrSoundActive = ambienceEnabled || soundSettings.enabled;

  return (
    <>
      <header
        className="relative flex items-center gap-3 px-3 py-1.5 flex-shrink-0 border-b"
        style={{
          background: 'var(--bg-deep)',
          borderColor: 'var(--border)',
          height: '56px',
        }}
      >
        {/* グロウライン */}
        <div className="header-glow-line" />

        {/* ナビゲーション：ホーム + タイトル */}
        <div className="flex items-center gap-2 min-w-0">
          <HeaderButton
            icon={<IconHome size={20} />}
            label="ホーム"
            shortLabel="Home"
            onClick={handleHomeClick}
          />

          {/* プロジェクトタイトル */}
          {isEditingTitle ? (
            <input
              className="input text-sm"
              style={{ width: '180px', padding: '2px 8px', height: '28px' }}
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSubmit();
                if (e.key === 'Escape') setIsEditingTitle(false);
              }}
              autoFocus
            />
          ) : (
            <button
              className="text-sm font-medium truncate max-w-[180px] transition-all duration-200"
              style={{
                fontFamily: 'var(--font-heading)',
                color: 'var(--accent)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                letterSpacing: '0.05em',
              }}
              onClick={handleProjectTitleClick}
              title="クリックして編集"
            >
              {currentProject?.title ?? ''}
            </button>
          )}

          {currentEpisode && (
            <>
              <span
                className="text-xs"
                style={{ color: 'var(--border-light)', opacity: 0.4 }}
              >
                /
              </span>
              <span
                className="text-sm truncate max-w-[160px]"
                style={{
                  color: 'var(--text-mid)',
                  fontFamily: 'var(--font-heading)',
                }}
              >
                {currentEpisode.title}
              </span>
            </>
          )}
        </div>

        {/* 右側のツール群 */}
        <div className="flex items-center gap-3 ml-auto">
          {/* 保存状態 */}
          {isDirty && (
            <span
              className="text-xs flex-shrink-0"
              style={{ color: 'var(--warning)', opacity: 0.8 }}
            >
              ● 未保存
            </span>
          )}

          {/* 保存ボタン（ラベル付き） */}
          <button
            className={`header-icon-btn header-icon-btn-labeled flex-col ${isDirty ? 'active' : ''}`}
            onClick={save}
            disabled={!isDirty || isSaving}
            style={{
              height: 'auto',
              minHeight: '44px',
              padding: '6px 8px 4px',
              gap: '2px',
              justifyContent: 'center'
            }}
          >
            <div className="flex items-center justify-center">
              <IconSave size={20} />
            </div>
            <span style={{ fontSize: '10px', lineHeight: 1, opacity: 0.8, transform: 'scale(0.95)' }}>
              {isSaving ? '保存中...' : '保存'}
            </span>
            <span className="tooltip">保存<span style={{ opacity: 0.5, marginLeft: '6px' }}>Ctrl+S</span></span>
          </button>

          {/* セパレータ */}
          <div
            className="w-px h-5 flex-shrink-0"
            style={{ background: 'var(--border)' }}
          />

          {/* 執筆ツールグループ: 検索・分析・校正・差分・縦書き */}
          <div className="header-btn-group">
            <HeaderButton
              icon={<IconSearch size={20} />}
              label="検索・置換"
              shortLabel="検索"
              shortcut="Ctrl+F"
              active={searchBarVisible}
              onClick={toggleSearchBar}
            />
            <HeaderButton
              icon={<IconAnalysis size={20} />}
              label="文章分析"
              shortLabel="分析"
              disabled={!hasEpisode}
              onClick={toggleAnalysisModal}
            />
            <HeaderButton
              icon={<IconProofread size={20} />}
              label="校正"
              shortLabel="校正"
              active={editorViewMode === 'proofread'}
              disabled={!hasEpisode}
              onClick={() =>
                setEditorViewMode(
                  editorViewMode === 'proofread' ? 'editor' : 'proofread',
                )
              }
            />
            <HeaderButton
              icon={<IconDiff size={20} />}
              label="差分"
              shortLabel="差分"
              active={editorViewMode === 'diff'}
              disabled={!hasEpisode}
              onClick={() =>
                setEditorViewMode(
                  editorViewMode === 'diff' ? 'editor' : 'diff',
                )
              }
            />
            <HeaderButton
              icon={<IconTategaki size={20} />}
              label="縦書き"
              shortLabel="縦書"
              active={isTategaki}
              onClick={toggleTategaki}
            />
          </div>

          {/* 演出・サウンドグループ（ポップオーバー付き） */}
          <div className="header-btn-group relative">
            <HeaderButton
              icon={ambienceIcon}
              label="演出ON/OFF"
              shortLabel="演出"
              active={ambienceEnabled}
              onClick={toggleAmbience}
            />
            <HeaderButton
              icon={soundSettings.enabled ? <IconSound size={20} /> : <IconSoundOff size={20} />}
              label="サウンドON/OFF"
              shortLabel="音"
              active={soundSettings.enabled}
              onClick={() => setSoundSettings({ ...soundSettings, enabled: !soundSettings.enabled })}
            />
            <HeaderButton
              icon={<IconGhost size={20} />}
              label="ゴーストちゃん ON/OFF"
              shortLabel="相棒"
              active={characterSettings.enabled}
              onClick={() => setCharacterSettings({ ...characterSettings, enabled: !characterSettings.enabled })}
            />
            <HeaderButton
              icon={theme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
              label={theme === 'dark' ? 'ライトモード' : 'ダークモード'}
              shortLabel="テーマ"
              onClick={toggleTheme}
            />
            {/* ポップオーバー展開ボタン */}
            <button
              className={`header-icon-btn ${ambienceOrSoundActive ? 'active' : ''}`}
              onClick={() => setShowAmbiencePopover((v) => !v)}
              style={{ padding: '0 3px', fontSize: '10px', minWidth: '16px', height: '44px' }}
            >
              ▼
            </button>
            {showAmbiencePopover && (
              <AmbiencePopover onClose={() => setShowAmbiencePopover(false)} />
            )}
          </div>

          {/* AI チャット */}
          <HeaderButton
            icon={<IconAi size={20} />}
            label="AIアシスタント"
            shortLabel="AI"
            active={aiPanelVisible}
            onClick={toggleAiPanel}
          />

          {/* 設定（独立） */}
          <HeaderButton
            icon={<IconSettings size={20} />}
            label="設定"
            shortLabel="設定"
            onClick={toggleSettingsModal}
          />

          {/* 出力メニュー */}
          <ExportMenu />
        </div>
      </header>

      {/* 未保存警告ダイアログ */}
      {showUnsavedWarning && (
        <div
          className="modal-overlay"
          onClick={() => setShowUnsavedWarning(false)}
        >
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2
              className="text-base font-medium mb-3"
              style={{ color: 'var(--text)' }}
            >
              未保存の変更があります
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-mid)' }}>
              保存せずにホームに戻りますか？
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="btn btn-ghost"
                onClick={() => setShowUnsavedWarning(false)}
              >
                キャンセル
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowUnsavedWarning(false);
                  navigateTo('home');
                }}
              >
                保存せずに戻る
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowUnsavedWarning(false);
                  handleSaveAndGoHome();
                }}
              >
                保存して戻る
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

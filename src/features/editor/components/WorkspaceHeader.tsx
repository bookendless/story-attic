/**
 * ワークスペース上部ヘッダー (再構成版)
 *
 * 常時必要な最頻出アクションのみを配置:
 *   ホーム / プロジェクト名 / ビューモード / 保存 / 検索 / AI / 出力 / コマンドパレット
 *
 * 以下の機能は他の場所に移動した:
 *   - 縦書き / テーマ / 演出 / 環境音 / ゴースト → StatusBar
 *   - 文章分析 / 校正 / 差分 / 執筆支援 / 設定 → CommandPalette (Ctrl+P)
 */

import { useState } from 'react';
import { useAppStore } from '@/shared/stores/appStore';
import { useProjectStore } from '@/shared/stores/projectStore';
import { useEditorStore } from '@/shared/stores/editorStore';
import { useUIStore } from '@/shared/stores/uiStore';
import { ViewModeSegmented } from './ViewModeSegmented';
import { ExportMenu } from './ExportMenu';
import {
  IconHome,
  IconSave,
  IconSearch,
  IconAi,
} from '@/shared/components/Icons';

function HeaderButton({
  icon,
  label,
  shortLabel,
  shortcut,
  description,
  tourId,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  shortLabel?: string;
  shortcut?: string;
  description?: string;
  tourId?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`header-icon-btn flex-col ${active ? 'active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      data-tour={tourId}
      style={{
        height: 'auto',
        minHeight: '44px',
        minWidth: '44px',
        padding: '6px 4px 4px',
        gap: '2px',
        justifyContent: 'center',
      }}
    >
      <div className="flex items-center justify-center">{icon}</div>
      <span style={{ fontSize: '10px', lineHeight: 1, opacity: active ? 1 : 0.8, transform: 'scale(0.95)' }}>
        {shortLabel || label}
      </span>
      <div className="tooltip" style={{ minWidth: '160px', maxWidth: '220px', padding: '10px 14px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 500, marginBottom: description ? '4px' : 0 }}>
          {label}
          {shortcut && (
            <span style={{ opacity: 0.5, marginLeft: '6px', fontSize: '11px' }}>{shortcut}</span>
          )}
        </div>
        {description && (
          <div style={{ fontSize: '11px', color: 'var(--text-mid)', lineHeight: 1.6, marginBottom: shortcut ? '6px' : 0 }}>
            {description}
          </div>
        )}
        {shortcut && description && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ショートカット:</span>
            <span style={{
              fontSize: '10px',
              color: 'var(--accent)',
              background: 'var(--accent-soft)',
              border: '1px solid rgba(196,149,106,0.3)',
              borderRadius: '4px',
              padding: '1px 6px',
            }}>{shortcut}</span>
          </div>
        )}
      </div>
    </button>
  );
}

export function WorkspaceHeader() {
  const navigateTo = useAppStore((s) => s.navigateTo);
  const currentProject = useProjectStore((s) => s.currentProject);
  const updateProject = useProjectStore((s) => s.updateProject);
  const { currentEpisode, isDirty, save, isSaving } = useEditorStore();
  const {
    toggleSearchBar,
    searchBarVisible,
    aiPanelVisible,
    toggleAiPanel,
    toggleCommandPalette,
  } = useUIStore();

  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [showHomeConfirm, setShowHomeConfirm] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');

  const handleHomeClick = () => {
    if (isDirty) {
      setShowUnsavedWarning(true);
    } else {
      setShowHomeConfirm(true);
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
        <div className="header-glow-line" />

        {/* 左: ホーム + プロジェクト名 */}
        <div className="flex items-center gap-2 min-w-0">
          <HeaderButton
            icon={<IconHome size={20} />}
            label="ホーム"
            shortLabel="Home"
            onClick={handleHomeClick}
          />
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
              <span className="text-xs" style={{ color: 'var(--border-light)', opacity: 0.4 }}>
                /
              </span>
              <span
                className="text-sm truncate max-w-[160px]"
                style={{ color: 'var(--text-mid)', fontFamily: 'var(--font-heading)' }}
              >
                {currentEpisode.title}
              </span>
            </>
          )}
        </div>

        {/* 中央: ビューモードセグメント */}
        <div className="flex-1 flex justify-center">
          <ViewModeSegmented />
        </div>

        {/* 右: 保存 / 検索 / AI / コマンドパレット */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isDirty && (
            <span className="text-xs" style={{ color: 'var(--warning)', opacity: 0.8 }}>
              ● 未保存
            </span>
          )}

          <button
            className={`header-icon-btn header-icon-btn-labeled flex-col ${isDirty ? 'active' : ''}`}
            onClick={save}
            disabled={!isDirty || isSaving}
            style={{
              height: 'auto',
              minHeight: '44px',
              padding: '6px 8px 4px',
              gap: '2px',
              justifyContent: 'center',
            }}
          >
            <div className="flex items-center justify-center">
              <IconSave size={20} />
            </div>
            <span style={{ fontSize: '10px', lineHeight: 1, opacity: 0.8, transform: 'scale(0.95)' }}>
              {isSaving ? '保存中...' : '保存'}
            </span>
            <div className="tooltip" style={{ minWidth: '160px', maxWidth: '220px', padding: '10px 14px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 500, marginBottom: '4px' }}>
                保存<span style={{ opacity: 0.5, marginLeft: '6px', fontSize: '11px' }}>Ctrl+S</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-mid)', lineHeight: 1.6, marginBottom: '6px' }}>
                エピソードを保存します
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ショートカット:</span>
                <span style={{ fontSize: '10px', color: 'var(--accent)', background: 'var(--accent-soft)', border: '1px solid rgba(196,149,106,0.3)', borderRadius: '4px', padding: '1px 6px' }}>Ctrl+S</span>
              </div>
            </div>
          </button>

          <div className="w-px h-5" style={{ background: 'var(--border)' }} />

          <HeaderButton
            icon={<IconSearch size={20} />}
            label="検索・置換"
            shortLabel="検索"
            shortcut="Ctrl+F"
            description="本文内のテキストを検索・置換できます"
            active={searchBarVisible}
            onClick={toggleSearchBar}
          />

          <HeaderButton
            icon={<IconAi size={20} />}
            label="AIアシスタント"
            shortLabel="AI"
            shortcut="Ctrl+Shift+A"
            description="構成案の生成・台詞提案・文章校正などをAIがサポート"
            tourId="ai-button"
            active={aiPanelVisible}
            onClick={toggleAiPanel}
          />

          <ExportMenu />

          <button
            className="header-icon-btn flex-col"
            onClick={toggleCommandPalette}
            title="コマンドパレット (Ctrl+P)"
            data-tour="command-palette-button"
            style={{
              height: 'auto',
              minHeight: '44px',
              minWidth: '44px',
              padding: '6px 4px 4px',
              gap: '2px',
              justifyContent: 'center',
            }}
          >
            <div className="flex items-center justify-center" style={{ fontSize: '14px', fontWeight: 600 }}>
              ⌘
            </div>
            <span style={{ fontSize: '10px', lineHeight: 1, opacity: 0.8, transform: 'scale(0.95)' }}>
              コマンド
            </span>
            <div className="tooltip" style={{ minWidth: '160px', maxWidth: '220px', padding: '10px 14px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 500, marginBottom: '4px' }}>
                コマンドパレット<span style={{ opacity: 0.5, marginLeft: '6px', fontSize: '11px' }}>Ctrl+P</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-mid)', lineHeight: 1.6, marginBottom: '6px' }}>
                文章分析・執筆支援・設定など全機能へアクセス
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ショートカット:</span>
                <span style={{ fontSize: '10px', color: 'var(--accent)', background: 'var(--accent-soft)', border: '1px solid rgba(196,149,106,0.3)', borderRadius: '4px', padding: '1px 6px' }}>Ctrl+P</span>
              </div>
            </div>
          </button>
        </div>
      </header>

      {showHomeConfirm && (
        <div className="modal-overlay" onClick={() => setShowHomeConfirm(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-medium mb-3" style={{ color: 'var(--text)' }}>
              ホームに戻りますか？
            </h2>
            <div className="flex justify-end gap-3">
              <button className="btn btn-ghost" onClick={() => setShowHomeConfirm(false)}>
                キャンセル
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowHomeConfirm(false);
                  navigateTo('home');
                }}
              >
                ホームへ戻る
              </button>
            </div>
          </div>
        </div>
      )}

      {showUnsavedWarning && (
        <div className="modal-overlay" onClick={() => setShowUnsavedWarning(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-medium mb-3" style={{ color: 'var(--text)' }}>
              未保存の変更があります
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-mid)' }}>
              保存せずにホームに戻りますか？
            </p>
            <div className="flex justify-end gap-3">
              <button className="btn btn-ghost" onClick={() => setShowUnsavedWarning(false)}>
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

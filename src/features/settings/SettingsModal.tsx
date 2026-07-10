import { useState, useEffect, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  useUIStore,
  DEFAULT_AMBIENCE_SETTINGS,
  DEFAULT_SOUND_SETTINGS,
  type AmbienceSettings,
  type SoundSettings,
  type ThemeMode,
} from '@/shared/stores/uiStore';
import { useProjectStore } from '@/shared/stores/projectStore';
import type { ProjectSettings, AiSettings, ProofreadSettings } from '@/shared/types';
import { DEFAULT_SETTINGS, DEFAULT_AI_SETTINGS, DEFAULT_PROOFREAD_SETTINGS } from '@/shared/types';
import { CATEGORIES, LEGACY_TAB_MAP, type SettingsCategoryKey } from './types';
import { TAB_KEYS } from './tabKeys';
import { SettingsNav } from './SettingsNav';
import { SettingsFooter } from './SettingsFooter';
import { WritingPanel } from './categories/WritingPanel';
import { DataPanel } from './categories/DataPanel';
import { ProofreadPanel } from './categories/ProofreadPanel';
import { AmbiencePanel } from './categories/AmbiencePanel';
import { AiPanel } from './categories/AiPanel';

// ドラフトをフラット化して差分検知に使うマップを生成する
function flattenDrafts(
  project: ProjectSettings,
  proofread: ProofreadSettings,
  ambience: AmbienceSettings,
  sound: SoundSettings,
  ai: AiSettings,
  theme: ThemeMode,
): Record<string, unknown> {
  return {
    // ProjectSettings
    auto_indent:            project.auto_indent,
    editor_font:            project.editor_font,
    editor_font_size:       project.editor_font_size,
    editor_max_width:       project.editor_max_width,
    vertical_tcy:           project.vertical_tcy,
    chars_per_line:         project.chars_per_line,
    lines_per_page:         project.lines_per_page,
    show_char_count:        project.show_char_count,
    auto_save:              project.auto_save,
    auto_save_interval_sec: project.auto_save_interval_sec,
    // テーマ
    theme,
    // ProofreadSettings
    proofread_enabled:    proofread.enabled,
    proofread_categories: proofread.categories,
    proofread_popup:      proofread.popup_enabled,
    // AmbienceSettings
    effectType: ambience.effectType,
    density:    ambience.density,
    speed:      ambience.speed,
    angle:      ambience.angle,
    opacity:    ambience.opacity,
    // SoundSettings
    sound_enabled:  sound.enabled,
    masterVolume:   sound.masterVolume,
    typingType:     sound.typingType,
    typingVolume:   sound.typingVolume,
    // AiSettings (api_key は Keyring 管理のため除外)
    provider:      ai.provider,
    model:         ai.model,
    system_prompt: ai.system_prompt,
    base_url:      ai.base_url,
  };
}

export function SettingsModal() {
  const {
    settingsModalVisible,
    toggleSettingsModal,
    settingsModalInitialTab,
    clearSettingsModalInitialTab,
    settings,
    setSettings,
    proofreadSettings,
    setProofreadSettings,
    ambienceSettings,
    setAmbienceSettings,
    soundSettings,
    setSoundSettings,
    theme,
    setTheme,
  } = useUIStore();
  const currentProject = useProjectStore((s) => s.currentProject);

  const [activeCategory, setActiveCategory] = useState<SettingsCategoryKey>('writing');

  // 5つのドラフト状態
  const [draftProject,  setDraftProject]  = useState<ProjectSettings>(settings);
  const [draftProofread, setDraftProofread] = useState<ProofreadSettings>(proofreadSettings);
  const [draftAmbience,  setDraftAmbience]  = useState<AmbienceSettings>(ambienceSettings);
  const [draftSound,     setDraftSound]     = useState<SoundSettings>(soundSettings);
  const [draftAi,        setDraftAi]        = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const [draftTheme,     setDraftTheme]     = useState<ThemeMode>(theme);

  // 保存済みスナップショット（差分基準）
  const [savedFlat, setSavedFlat] = useState<Record<string, unknown>>(() =>
    flattenDrafts(settings, proofreadSettings, ambienceSettings, soundSettings, DEFAULT_AI_SETTINGS, theme)
  );

  const [saving, setSaving] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // モーダルを開いた時に最新値でドラフトを初期化
  useEffect(() => {
    if (!settingsModalVisible) return;
    setDraftProject(settings);
    setDraftProofread(proofreadSettings);
    setDraftAmbience(ambienceSettings);
    setDraftSound(soundSettings);
    setDraftTheme(theme);

    // AI設定をDBから取得
    if (currentProject) {
      invoke<AiSettings>('ai_get_settings', { projectId: currentProject.id })
        .then((s) => {
          const loaded: AiSettings = {
            provider:      s.provider,
            model:         s.model,
            system_prompt: s.system_prompt,
            base_url:      s.base_url,
          };
          setDraftAi(loaded);
          setSavedFlat(flattenDrafts(settings, proofreadSettings, ambienceSettings, soundSettings, loaded, theme));
        })
        .catch(() => {
          setSavedFlat(flattenDrafts(settings, proofreadSettings, ambienceSettings, soundSettings, DEFAULT_AI_SETTINGS, theme));
        });
    } else {
      setSavedFlat(flattenDrafts(settings, proofreadSettings, ambienceSettings, soundSettings, DEFAULT_AI_SETTINGS, theme));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsModalVisible]);

  // 初期タブ指定（LEGACY_TAB_MAP で正規化）
  useEffect(() => {
    if (settingsModalVisible && settingsModalInitialTab) {
      const cat = LEGACY_TAB_MAP[settingsModalInitialTab] ?? (settingsModalInitialTab as SettingsCategoryKey);
      if (CATEGORIES.some((c) => c.key === cat)) setActiveCategory(cat);
      clearSettingsModalInitialTab();
    }
  }, [settingsModalVisible, settingsModalInitialTab, clearSettingsModalInitialTab]);

  // 差分検知
  const draftFlat = useMemo(
    () => flattenDrafts(draftProject, draftProofread, draftAmbience, draftSound, draftAi, draftTheme),
    [draftProject, draftProofread, draftAmbience, draftSound, draftAi, draftTheme],
  );

  const changedKeys = useMemo(
    () => Object.keys(savedFlat).filter((k) => JSON.stringify(savedFlat[k]) !== JSON.stringify(draftFlat[k])),
    [savedFlat, draftFlat],
  );

  const dirtyMap = useMemo(
    () => Object.fromEntries(
      CATEGORIES.map((c) => [c.key, TAB_KEYS[c.key].some((k) => changedKeys.includes(k))])
    ) as Record<SettingsCategoryKey, boolean>,
    [changedKeys],
  );

  const isDirty = changedKeys.length > 0;

  // =========== ハンドラー ===========

  const handleSave = useCallback(async () => {
    if (!currentProject) return;
    setSaving(true);
    try {
      // 1. ProjectSettings → DB
      await invoke('save_settings', { projectId: currentProject.id, settings: draftProject });
      setSettings(draftProject);
      // 2. ProofreadSettings → uiStore / localStorage
      setProofreadSettings(draftProofread);
      // 3. AmbienceSettings → uiStore / localStorage
      setAmbienceSettings(draftAmbience);
      // 4. SoundSettings → uiStore / localStorage
      setSoundSettings(draftSound);
      // 5. Theme → uiStore / localStorage
      setTheme(draftTheme);
      // 6. AiSettings → DB（creator_type を保持してマージ）
      const existing = await invoke<AiSettings>('ai_get_settings', { projectId: currentProject.id });
      await invoke('ai_save_settings', {
        projectId: currentProject.id,
        settings: { ...draftAi, creator_type: (existing as AiSettings & { creator_type?: string }).creator_type },
      });
      // 7. saved スナップショット更新
      setSavedFlat(flattenDrafts(draftProject, draftProofread, draftAmbience, draftSound, draftAi, draftTheme));
      // 8. トースト
      const n = changedKeys.length;
      setSaveToast(`${n}件の変更を保存しました`);
      setTimeout(() => setSaveToast(null), 2400);
    } catch (e) {
      console.error('設定保存エラー:', e);
    } finally {
      setSaving(false);
    }
  }, [currentProject, draftProject, draftProofread, draftAmbience, draftSound, draftAi, draftTheme, changedKeys.length, setSettings, setProofreadSettings, setAmbienceSettings, setSoundSettings, setTheme]);

  const handleCancel = () => {
    setDraftProject(settings);
    setDraftProofread(proofreadSettings);
    setDraftAmbience(ambienceSettings);
    setDraftSound(soundSettings);
    setDraftTheme(theme);
    // AI は savedFlat 生成時の値に戻す（savedFlat から逆算する代わりにモーダルを再開しリロードさせる）
    setSavedFlat(flattenDrafts(settings, proofreadSettings, ambienceSettings, soundSettings, draftAi, theme));
  };

  const handleResetTab = () => {
    switch (activeCategory) {
      case 'writing':
        setDraftProject((p) => ({
          ...p,
          auto_indent:      DEFAULT_SETTINGS.auto_indent,
          editor_font:      DEFAULT_SETTINGS.editor_font,
          editor_font_size: DEFAULT_SETTINGS.editor_font_size,
          editor_max_width: DEFAULT_SETTINGS.editor_max_width,
          vertical_tcy:     DEFAULT_SETTINGS.vertical_tcy,
          chars_per_line:   DEFAULT_SETTINGS.chars_per_line,
          lines_per_page:   DEFAULT_SETTINGS.lines_per_page,
          show_char_count:  DEFAULT_SETTINGS.show_char_count,
        }));
        setDraftTheme('dark');
        break;
      case 'data':
        setDraftProject((p) => ({
          ...p,
          auto_save:              DEFAULT_SETTINGS.auto_save,
          auto_save_interval_sec: DEFAULT_SETTINGS.auto_save_interval_sec,
        }));
        break;
      case 'proofread':
        setDraftProofread(DEFAULT_PROOFREAD_SETTINGS);
        break;
      case 'ambience':
        setDraftAmbience(DEFAULT_AMBIENCE_SETTINGS);
        setDraftSound(DEFAULT_SOUND_SETTINGS);
        break;
      case 'ai':
        setDraftAi(DEFAULT_AI_SETTINGS);
        break;
    }
  };

  const handleResetAll = () => {
    setDraftProject(DEFAULT_SETTINGS);
    setDraftProofread(DEFAULT_PROOFREAD_SETTINGS);
    setDraftAmbience(DEFAULT_AMBIENCE_SETTINGS);
    setDraftSound(DEFAULT_SOUND_SETTINGS);
    setDraftTheme('dark');
    setDraftAi(DEFAULT_AI_SETTINGS);
  };

  // =========== キーボード ===========

  useEffect(() => {
    if (!settingsModalVisible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        toggleSettingsModal();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty && !saving) void handleSave();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [settingsModalVisible, isDirty, saving, handleSave, toggleSettingsModal]);

  if (!settingsModalVisible) return null;

  // アクティブパネルの選択
  const renderPanel = () => {
    switch (activeCategory) {
      case 'writing':
        return (
          <WritingPanel
            draftProject={draftProject}
            onProjectChange={(patch) => setDraftProject((p) => ({ ...p, ...patch }))}
            draftTheme={draftTheme}
            onThemeChange={setDraftTheme}
          />
        );
      case 'data':
        return (
          <DataPanel
            draftProject={draftProject}
            onProjectChange={(patch) => setDraftProject((p) => ({ ...p, ...patch }))}
            currentProjectId={currentProject?.id ?? null}
          />
        );
      case 'proofread':
        return (
          <ProofreadPanel
            draftProofread={draftProofread}
            onProofreadChange={(patch) => setDraftProofread((p) => ({ ...p, ...patch }))}
          />
        );
      case 'ambience':
        return (
          <AmbiencePanel
            draftAmbience={draftAmbience}
            onAmbienceChange={(patch) => setDraftAmbience((p) => ({ ...p, ...patch }))}
            draftSound={draftSound}
            onSoundChange={(patch) => setDraftSound((p) => ({ ...p, ...patch }))}
          />
        );
      case 'ai':
        return <AiPanel draftAi={draftAi} onAiChange={setDraftAi} />;
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={toggleSettingsModal}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="設定"
        className="modal-box"
        style={{
          width: '880px',
          maxWidth: '880px',
          height: 'min(640px, 90vh)',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-heading)', margin: 0 }}>
              設定
            </h2>
            {isDirty && (
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: 'var(--bg-deep)',
                  color: 'var(--warning)',
                  border: '1px solid var(--warning)',
                }}
              >
                未保存 {changedKeys.length}件
              </span>
            )}
          </div>
          <button
            type="button"
            aria-label="閉じる"
            onClick={toggleSettingsModal}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '18px',
              lineHeight: 1,
              padding: '2px 6px',
            }}
          >
            ×
          </button>
        </div>

        {/* ボディ: ナビ + コンテンツ */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <SettingsNav
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            dirtyMap={dirtyMap}
            currentProjectTitle={currentProject?.title}
          />
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px 24px',
            }}
          >
            {renderPanel()}
          </div>
        </div>

        {/* フッター */}
        <SettingsFooter
          isDirty={isDirty}
          saving={saving}
          changedCount={changedKeys.length}
          activeCategory={activeCategory}
          saveToast={saveToast}
          onSave={handleSave}
          onCancel={handleCancel}
          onResetTab={handleResetTab}
          onResetAll={handleResetAll}
        />
      </div>
    </div>
  );
}

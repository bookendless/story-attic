import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  useUIStore,
  DEFAULT_AMBIENCE_SETTINGS,
  DEFAULT_SOUND_SETTINGS,
  type AmbienceSettings,
  type SoundSettings,
  type AmbientType,
  type TypingSoundType,
} from '@/shared/stores/uiStore';
import { useProjectStore } from '@/shared/stores/projectStore';
import type { ProjectSettings, AiSettings } from '@/shared/types';
import { DEFAULT_SETTINGS, DEFAULT_AI_SETTINGS } from '@/shared/types';
import { AiSettingsTab, DEFAULT_MODELS } from '@/features/ai/AiSettingsTab';

/** 設定カテゴリのタブ */
type SettingsTab = 'editor' | 'save' | 'display' | 'manuscript' | 'proofread' | 'ambience' | 'sound' | 'ai' | 'storage';

interface StorageStats {
  dbSizeBytes: number;
  episodeBodyBytes: number;
  snapshotBytes: number;
  snapshotCount: number;
  episodeCount: number;
}

const FONT_OPTIONS = [
  // 明朝体
  { value: '游明朝', label: '游明朝', category: '明朝体' },
  { value: 'Noto Serif JP', label: 'Noto Serif JP', category: '明朝体' },
  { value: 'Shippori Mincho', label: 'しっぽり明朝', category: '明朝体' },
  { value: 'Sawarabi Mincho', label: 'さわらび明朝', category: '明朝体' },
  { value: 'Zen Old Mincho', label: 'Zen オールド明朝', category: '明朝体' },
  { value: 'BIZ UDMincho', label: 'BIZ UD明朝', category: '明朝体' },
  { value: 'ヒラギノ明朝 ProN', label: 'ヒラギノ明朝', category: '明朝体' },
  { value: 'MS 明朝', label: 'MS 明朝', category: '明朝体' },
  // ゴシック体
  { value: 'Zen Kaku Gothic New', label: 'Zen 角ゴシック', category: 'ゴシック体' },
  { value: 'Zen Maru Gothic', label: 'Zen 丸ゴシック', category: 'ゴシック体' },
  { value: 'Noto Sans JP', label: 'Noto Sans JP', category: 'ゴシック体' },
  // 手書き風
  { value: 'Klee One', label: 'クレー', category: '手書き風' },
];

const AUTO_SAVE_INTERVALS = [
  { label: '30秒', value: 30 },
  { label: '1分', value: 60 },
  { label: '3分', value: 180 },
  { label: '5分', value: 300 },
];

const PROOFREAD_CATEGORIES = ['二重表現', '誤用', '冗長表現', '記号'];

const AMBIENT_OPTIONS: { key: AmbientType; label: string }[] = [
  { key: 'rain', label: '雨音' },
  { key: 'fireplace', label: '焚き火' },
  { key: 'forest', label: '森・鳥の声' },
  { key: 'cafe', label: 'カフェ' },
  { key: 'waves', label: '波の音' },
];

const TYPING_OPTIONS: { key: TypingSoundType; label: string }[] = [
  { key: 'none', label: 'なし' },
  { key: 'mechanical', label: '機械式キーボード' },
  { key: 'wooden', label: '木製キーボード' },
  { key: 'soft', label: '静音' },
];

export function SettingsModal() {
  const { settingsModalVisible, toggleSettingsModal, settingsModalInitialTab, clearSettingsModalInitialTab, settings, setSettings, proofreadSettings, setProofreadSettings, ambienceSettings, setAmbienceSettings, soundSettings, setSoundSettings } = useUIStore();
  const currentProject = useProjectStore((s) => s.currentProject);
  const [tab, setTab] = useState<SettingsTab>('editor');
  const [local, setLocal] = useState<ProjectSettings>(settings);
  const [localProofread, setLocalProofread] = useState(proofreadSettings);
  const [localAmbience, setLocalAmbience] = useState<AmbienceSettings>(ambienceSettings);
  const [localSound, setLocalSound] = useState<SoundSettings>(soundSettings);
  const [localAi, setLocalAi] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [trimKeepCount, setTrimKeepCount] = useState(5);
  const [storageMsg, setStorageMsg] = useState<string | null>(null);

  // モーダルを開いた時に最新の設定を反映
  useEffect(() => {
    if (settingsModalVisible) {
      setLocal(settings);
      setLocalProofread(proofreadSettings);
      setLocalAmbience(ambienceSettings);
      setLocalSound(soundSettings);
      // AI設定をDBから取得
      if (currentProject) {
        invoke<AiSettings>('ai_get_settings', { projectId: currentProject.id })
          .then((s) =>
            setLocalAi({
              provider: s.provider,
              // モデルが未設定の場合はプロバイダーのデフォルトを補完
              model: s.model || DEFAULT_MODELS[s.provider] || '',
              system_prompt: s.system_prompt,
              base_url: s.base_url,
            }),
          ).catch(() => {});
      }
    }
  }, [settingsModalVisible, settings, proofreadSettings, ambienceSettings, soundSettings, currentProject]);

  // 初期タブ指定があれば適用（呼び出し元が openSettingsModal で指定）
  useEffect(() => {
    if (settingsModalVisible && settingsModalInitialTab) {
      setTab(settingsModalInitialTab as SettingsTab);
      clearSettingsModalInitialTab();
    }
  }, [settingsModalVisible, settingsModalInitialTab, clearSettingsModalInitialTab]);

  const updateLocal = (patch: Partial<ProjectSettings>) => {
    setLocal((prev) => ({ ...prev, ...patch }));
  };

  const loadStorageStats = useCallback(async () => {
    if (!currentProject) return;
    setStorageLoading(true);
    setStorageMsg(null);
    try {
      const raw = await invoke<Record<string, unknown>>('get_storage_stats', { projectId: currentProject.id });
      // snake_case → camelCase
      setStorageStats({
        dbSizeBytes: raw['db_size_bytes'] as number,
        episodeBodyBytes: raw['episode_body_bytes'] as number,
        snapshotBytes: raw['snapshot_bytes'] as number,
        snapshotCount: raw['snapshot_count'] as number,
        episodeCount: raw['episode_count'] as number,
      });
    } catch { /* 無視 */ } finally {
      setStorageLoading(false);
    }
  }, [currentProject]);

  const handleSave = async () => {
    if (!currentProject) return;
    setSaving(true);
    try {
      await invoke('save_settings', { projectId: currentProject.id, settings: local });
      setSettings(local);
      setProofreadSettings(localProofread);
      setAmbienceSettings(localAmbience);
      setSoundSettings(localSound);
      // AI設定を保存
      await invoke('ai_save_settings', {
        projectId: currentProject.id,
        settings: localAi,
      });
      toggleSettingsModal();
    } catch (e) {
      console.error('設定保存エラー:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setLocal(DEFAULT_SETTINGS);
    setLocalAmbience(DEFAULT_AMBIENCE_SETTINGS);
    setLocalSound(DEFAULT_SOUND_SETTINGS);
  };

  const updateLocalAmbience = (patch: Partial<AmbienceSettings>) => {
    setLocalAmbience((prev) => ({ ...prev, ...patch }));
  };

  const updateLocalSound = (patch: Partial<SoundSettings>) => {
    setLocalSound((prev) => ({ ...prev, ...patch }));
  };

  /** 環境音の選択をトグルする */
  const toggleAmbientType = (type: AmbientType) => {
    setLocalSound((prev) => {
      const active = prev.activeAmbients.includes(type)
        ? prev.activeAmbients.filter((t) => t !== type)
        : [...prev.activeAmbients, type];
      return { ...prev, activeAmbients: active };
    });
  };

  if (!settingsModalVisible) return null;

  const handleTabChange = (t: SettingsTab) => {
    setTab(t);
    if (t === 'storage') loadStorageStats();
  };

  const handleDeleteAllSnapshots = async () => {
    if (!currentProject) return;
    if (!window.confirm('この作品のスナップショットをすべて削除しますか？この操作は元に戻せません。')) return;
    try {
      const deleted = await invoke<number>('delete_all_snapshots', { projectId: currentProject.id });
      setStorageMsg(`${deleted} 件のスナップショットを削除しました`);
      await loadStorageStats();
    } catch { /* 無視 */ }
  };

  const handleTrimSnapshots = async () => {
    if (!currentProject) return;
    try {
      const deleted = await invoke<number>('trim_snapshots', { projectId: currentProject.id, keepCount: trimKeepCount });
      setStorageMsg(deleted > 0 ? `${deleted} 件の古いスナップショットを削除しました` : '削除対象はありませんでした');
      await loadStorageStats();
    } catch { /* 無視 */ }
  };

  const tabs: { key: SettingsTab; label: string }[] = [
    { key: 'editor', label: 'エディタ' },
    { key: 'save', label: '保存' },
    { key: 'display', label: '表示' },
    { key: 'manuscript', label: '原稿' },
    { key: 'proofread', label: '校正' },
    { key: 'ambience', label: '演出' },
    { key: 'sound', label: 'サウンド' },
    { key: 'ai', label: 'AI' },
    { key: 'storage', label: 'データ管理' },
  ];

  return (
    <div className="modal-overlay" onClick={toggleSettingsModal}>
      <div
        className="modal-box"
        style={{ maxWidth: '600px', height: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="text-base font-medium mb-4"
          style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}
        >
          設定
        </h2>

        {/* タブ */}
        <div className="flex gap-1 mb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              className="text-xs px-3 py-2"
              style={{
                color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)',
                background: 'none',
                border: 'none',
                borderBottomWidth: '2px',
                borderBottomStyle: 'solid',
                borderBottomColor: tab === t.key ? 'var(--accent)' : 'transparent',
                cursor: 'pointer',
                fontWeight: tab === t.key ? 600 : 400,
              }}
              onClick={() => handleTabChange(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 設定内容（ここだけスクロール） */}
        <div className="space-y-4" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {tab === 'editor' && (
            <>
              <SettingRow label="自動字下げ">
                <ToggleSwitch
                  checked={local.auto_indent}
                  onChange={(v) => updateLocal({ auto_indent: v })}
                />
              </SettingRow>
              <SettingRow label="フォント">
                <select
                  className="input text-sm"
                  style={{ width: '200px', padding: '4px 8px' }}
                  value={local.editor_font}
                  onChange={(e) => updateLocal({ editor_font: e.target.value })}
                >
                  {(['明朝体', 'ゴシック体', '手書き風'] as const).map((cat) => (
                    <optgroup key={cat} label={cat}>
                      {FONT_OPTIONS.filter((f) => f.category === cat).map((f) => (
                        <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                          {f.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </SettingRow>
              <SettingRow label="フォントサイズ">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={12}
                    max={28}
                    step={1}
                    value={local.editor_font_size}
                    onChange={(e) => updateLocal({ editor_font_size: Number(e.target.value) })}
                    style={{ width: '120px', accentColor: 'var(--accent)' }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-mid)', width: '40px' }}>
                    {local.editor_font_size}px
                  </span>
                </div>
              </SettingRow>
              <SettingRow label="エディタ最大幅">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={1200}
                    step={20}
                    value={local.editor_max_width}
                    onChange={(e) => updateLocal({ editor_max_width: Number(e.target.value) })}
                    style={{ width: '120px', accentColor: 'var(--accent)' }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-mid)', width: '50px' }}>
                    {local.editor_max_width === 0 ? '制限なし' : `${local.editor_max_width}px`}
                  </span>
                </div>
              </SettingRow>
            </>
          )}

          {tab === 'save' && (
            <>
              <SettingRow label="自動保存">
                <ToggleSwitch
                  checked={local.auto_save}
                  onChange={(v) => updateLocal({ auto_save: v })}
                />
              </SettingRow>
              <SettingRow label="自動保存間隔">
                <select
                  className="input text-sm"
                  style={{ width: '120px', padding: '4px 8px' }}
                  value={local.auto_save_interval_sec}
                  onChange={(e) => updateLocal({ auto_save_interval_sec: Number(e.target.value) })}
                  disabled={!local.auto_save}
                >
                  {AUTO_SAVE_INTERVALS.map((i) => (
                    <option key={i.value} value={i.value}>{i.label}</option>
                  ))}
                </select>
              </SettingRow>
            </>
          )}

          {tab === 'display' && (
            <>
              <SettingRow label="カラーテーマ">
                <select
                  className="input text-sm"
                  style={{ width: '140px', padding: '4px 8px' }}
                  value={useUIStore.getState().theme}
                  onChange={(e) => {
                    const val = e.target.value as 'dark' | 'light';
                    useUIStore.getState().setTheme(val);
                  }}
                >
                  <option value="dark">ダーク（屋根裏）</option>
                  <option value="light">ライト（和紙）</option>
                </select>
              </SettingRow>
              <SettingRow label="文字数カウント表示">
                <ToggleSwitch
                  checked={local.show_char_count}
                  onChange={(v) => updateLocal({ show_char_count: v })}
                />
              </SettingRow>
            </>
          )}

          {tab === 'manuscript' && (
            <>
              <SettingRow label="1行の文字数">
                <input
                  type="number"
                  className="input text-sm"
                  style={{ width: '80px', padding: '4px 8px' }}
                  min={20}
                  max={80}
                  value={local.chars_per_line}
                  onChange={(e) => updateLocal({ chars_per_line: Number(e.target.value) })}
                />
              </SettingRow>
              <SettingRow label="1ページの行数">
                <input
                  type="number"
                  className="input text-sm"
                  style={{ width: '80px', padding: '4px 8px' }}
                  min={10}
                  max={50}
                  value={local.lines_per_page}
                  onChange={(e) => updateLocal({ lines_per_page: Number(e.target.value) })}
                />
              </SettingRow>
            </>
          )}

          {tab === 'proofread' && (
            <>
              <SettingRow label="校正機能">
                <ToggleSwitch
                  checked={localProofread.enabled}
                  onChange={(v) => setLocalProofread((prev) => ({ ...prev, enabled: v }))}
                />
              </SettingRow>
              {PROOFREAD_CATEGORIES.map((cat) => (
                <SettingRow key={cat} label={`  ${cat}`}>
                  <ToggleSwitch
                    checked={localProofread.categories[cat] ?? true}
                    onChange={(v) =>
                      setLocalProofread((prev) => ({
                        ...prev,
                        categories: { ...prev.categories, [cat]: v },
                      }))
                    }
                    disabled={!localProofread.enabled}
                  />
                </SettingRow>
              ))}
              <SettingRow label="選択語句ポップアップ">
                <ToggleSwitch
                  checked={localProofread.popup_enabled}
                  onChange={(v) => setLocalProofread((prev) => ({ ...prev, popup_enabled: v }))}
                  disabled={!localProofread.enabled}
                />
              </SettingRow>
            </>
          )}

          {tab === 'ambience' && (
            <>
              <SettingRow label="演出タイプ">
                <select
                  className="input text-sm"
                  style={{ width: '120px', padding: '4px 8px' }}
                  value={localAmbience.effectType}
                  onChange={(e) => updateLocalAmbience({ effectType: e.target.value as AmbienceSettings['effectType'] })}
                >
                  <option value="rain">雨</option>
                  <option value="snow">雪</option>
                  <option value="sakura">桜</option>
                </select>
              </SettingRow>
              <SettingRow label="密度">
                <select
                  className="input text-sm"
                  style={{ width: '120px', padding: '4px 8px' }}
                  value={localAmbience.density}
                  onChange={(e) => updateLocalAmbience({ density: e.target.value as AmbienceSettings['density'] })}
                >
                  <option value="sparse">疎（少なめ）</option>
                  <option value="normal">普通</option>
                  <option value="dense">密（多め）</option>
                </select>
              </SettingRow>
              <SettingRow label="速度">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={localAmbience.speed}
                    onChange={(e) => updateLocalAmbience({ speed: Number(e.target.value) })}
                    style={{ width: '120px', accentColor: 'var(--accent)' }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-mid)', width: '24px' }}>
                    {localAmbience.speed}
                  </span>
                </div>
              </SettingRow>
              <SettingRow label="角度">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={-30}
                    max={30}
                    step={5}
                    value={localAmbience.angle}
                    onChange={(e) => updateLocalAmbience({ angle: Number(e.target.value) })}
                    style={{ width: '120px', accentColor: 'var(--accent)' }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-mid)', width: '30px' }}>
                    {localAmbience.angle}°
                  </span>
                </div>
              </SettingRow>
              <SettingRow label="透明度">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0.1}
                    max={0.8}
                    step={0.05}
                    value={localAmbience.opacity}
                    onChange={(e) => updateLocalAmbience({ opacity: Number(e.target.value) })}
                    style={{ width: '120px', accentColor: 'var(--accent)' }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-mid)', width: '36px' }}>
                    {Math.round(localAmbience.opacity * 100)}%
                  </span>
                </div>
              </SettingRow>
            </>
          )}

          {tab === 'ai' && (
            <AiSettingsTab
              value={localAi}
              onChange={setLocalAi}
              SettingRow={SettingRow}
            />
          )}

          {tab === 'storage' && (
            <StorageTab
              stats={storageStats}
              loading={storageLoading}
              msg={storageMsg}
              trimKeepCount={trimKeepCount}
              onTrimKeepCountChange={setTrimKeepCount}
              onRefresh={loadStorageStats}
              onDeleteAll={handleDeleteAllSnapshots}
              onTrim={handleTrimSnapshots}
            />
          )}

          {tab === 'sound' && (
            <>
              <SettingRow label="サウンド全体">
                <ToggleSwitch
                  checked={localSound.enabled}
                  onChange={(v) => updateLocalSound({ enabled: v })}
                />
              </SettingRow>
              <SettingRow label="マスターボリューム">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={localSound.masterVolume}
                    onChange={(e) => updateLocalSound({ masterVolume: Number(e.target.value) })}
                    style={{ width: '120px', accentColor: 'var(--accent)' }}
                    disabled={!localSound.enabled}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-mid)', width: '36px' }}>
                    {Math.round(localSound.masterVolume * 100)}%
                  </span>
                </div>
              </SettingRow>

              {/* 環境音セクション */}
              <div className="mt-2 mb-1">
                <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>環境音</span>
              </div>
              <SettingRow label="環境音ボリューム">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={localSound.ambientVolume}
                    onChange={(e) => updateLocalSound({ ambientVolume: Number(e.target.value) })}
                    style={{ width: '120px', accentColor: 'var(--accent)' }}
                    disabled={!localSound.enabled}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-mid)', width: '36px' }}>
                    {Math.round(localSound.ambientVolume * 100)}%
                  </span>
                </div>
              </SettingRow>
              {AMBIENT_OPTIONS.map((opt) => (
                <SettingRow key={opt.key} label={`  ${opt.label}`}>
                  <ToggleSwitch
                    checked={localSound.activeAmbients.includes(opt.key)}
                    onChange={() => toggleAmbientType(opt.key)}
                    disabled={!localSound.enabled}
                  />
                </SettingRow>
              ))}

              {/* タイピング音セクション */}
              <div className="mt-2 mb-1">
                <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>タイピング音</span>
              </div>
              <SettingRow label="種類">
                <select
                  className="input text-sm"
                  style={{ width: '160px', padding: '4px 8px' }}
                  value={localSound.typingType}
                  onChange={(e) => updateLocalSound({ typingType: e.target.value as TypingSoundType })}
                  disabled={!localSound.enabled}
                >
                  {TYPING_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
              </SettingRow>
              <SettingRow label="タイピング音量">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={localSound.typingVolume}
                    onChange={(e) => updateLocalSound({ typingVolume: Number(e.target.value) })}
                    style={{ width: '120px', accentColor: 'var(--accent)' }}
                    disabled={!localSound.enabled || localSound.typingType === 'none'}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-mid)', width: '36px' }}>
                    {Math.round(localSound.typingVolume * 100)}%
                  </span>
                </div>
              </SettingRow>
            </>
          )}
        </div>

        {/* フッター */}
        <div className="flex justify-between mt-6">
          <button className="btn btn-ghost text-xs" onClick={handleReset}>
            初期値に戻す
          </button>
          <div className="flex gap-2">
            <button className="btn btn-ghost text-xs" onClick={toggleSettingsModal}>
              キャンセル
            </button>
            <button
              className="btn btn-primary text-xs"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================
// 共通サブコンポーネント
// =========================================

// =========================================
// ストレージ管理タブ
// =========================================

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface StorageTabProps {
  stats: StorageStats | null;
  loading: boolean;
  msg: string | null;
  trimKeepCount: number;
  onTrimKeepCountChange: (n: number) => void;
  onRefresh: () => void;
  onDeleteAll: () => void;
  onTrim: () => void;
}

function StorageTab({
  stats, loading, msg, trimKeepCount, onTrimKeepCountChange, onRefresh, onDeleteAll, onTrim,
}: StorageTabProps) {
  const barTotal = stats ? stats.episodeBodyBytes + stats.snapshotBytes : 0;
  const bodyPct = barTotal > 0 ? (stats!.episodeBodyBytes / barTotal) * 100 : 0;
  const snapPct = barTotal > 0 ? (stats!.snapshotBytes / barTotal) * 100 : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* DB全体サイズ */}
      <div
        className="flex items-center justify-between p-3 rounded"
        style={{ background: 'var(--bg-deep)', border: '1px solid var(--border)' }}
      >
        <span className="text-sm" style={{ color: 'var(--text-mid)' }}>データベース全体</span>
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          {stats ? formatBytes(stats.dbSizeBytes) : '—'}
        </span>
      </div>

      {/* 使用量の内訳 */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>使用量の内訳</span>

        {loading && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>読み込み中…</span>
        )}

        {stats && !loading && (
          <>
            {/* 積み上げバー */}
            {barTotal > 0 && (
              <div
                className="flex rounded overflow-hidden"
                style={{ height: '10px', background: 'var(--bg-deep)', gap: '1px' }}
              >
                <div style={{ width: `${bodyPct}%`, background: 'var(--accent)', transition: 'width 0.4s' }} />
                <div style={{ width: `${snapPct}%`, background: 'var(--warning, #c9a84c)', transition: 'width 0.4s' }} />
              </div>
            )}

            {/* 凡例 */}
            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--accent)', flexShrink: 0 }} />
                  <span className="text-xs" style={{ color: 'var(--text-mid)' }}>
                    本文データ（{stats.episodeCount} 話）
                  </span>
                </div>
                <span className="text-xs" style={{ color: 'var(--text)' }}>{formatBytes(stats.episodeBodyBytes)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--warning, #c9a84c)', flexShrink: 0 }} />
                  <span className="text-xs" style={{ color: 'var(--text-mid)' }}>
                    スナップショット（{stats.snapshotCount} 件、圧縮済み）
                  </span>
                </div>
                <span className="text-xs" style={{ color: 'var(--text)' }}>{formatBytes(stats.snapshotBytes)}</span>
              </div>
            </div>
          </>
        )}

        <button
          className="text-xs self-end"
          style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={onRefresh}
          disabled={loading}
        >
          ↻ 更新
        </button>
      </div>

      {/* スナップショット管理 */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>スナップショット管理</span>

        {/* 整理（最新N件保持） */}
        <div
          className="flex flex-col gap-2 p-3 rounded"
          style={{ background: 'var(--bg-deep)', border: '1px solid var(--border)' }}
        >
          <span className="text-xs" style={{ color: 'var(--text-mid)' }}>
            各エピソードの最新N件だけを残して古いものを削除します
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text-mid)' }}>保持件数</span>
            <select
              className="input text-xs"
              style={{ width: '80px', padding: '3px 6px' }}
              value={trimKeepCount}
              onChange={(e) => onTrimKeepCountChange(Number(e.target.value))}
            >
              {[1, 2, 3, 5, 7].map((n) => (
                <option key={n} value={n}>{n} 件</option>
              ))}
            </select>
            <button
              className="btn btn-ghost text-xs px-3 py-1"
              onClick={onTrim}
            >
              整理する
            </button>
          </div>
        </div>

        {/* 全削除 */}
        <div
          className="flex items-center justify-between p-3 rounded"
          style={{ background: 'var(--bg-deep)', border: '1px solid var(--border)' }}
        >
          <span className="text-xs" style={{ color: 'var(--text-mid)' }}>
            すべてのスナップショットを削除する
          </span>
          <button
            className="btn text-xs px-3 py-1"
            style={{
              background: 'none',
              border: '1px solid var(--danger)',
              color: 'var(--danger)',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
            onClick={onDeleteAll}
          >
            全削除
          </button>
        </div>
      </div>

      {/* フィードバックメッセージ */}
      {msg && (
        <span className="text-xs" style={{ color: 'var(--success)' }}>{msg}</span>
      )}
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm" style={{ color: 'var(--text-mid)' }}>{label}</span>
      {children}
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: '40px',
        height: '22px',
        borderRadius: '11px',
        background: checked ? 'var(--accent)' : 'var(--bg-deep)',
        border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 200ms, border-color 200ms',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '2px',
          left: checked ? '20px' : '2px',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          background: checked ? 'var(--bg-deep)' : 'var(--text-muted)',
          transition: 'left 200ms',
        }}
      />
    </button>
  );
}

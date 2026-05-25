/**
 * 演出・サウンド統合ポップオーバー
 * ヘッダーボタンから開き、演出タイプ切替・環境音・タイピング音を即時操作できる。
 */

import { useUIStore, type EffectType, type TypingSoundType } from '@/shared/stores/uiStore';
import { BGM_TRACKS } from './generators/bgmTracks';
import { soundManager } from './SoundManager';

const EFFECT_OPTIONS: { key: EffectType; label: string }[] = [
  { key: 'rain', label: '雨' },
  { key: 'snow', label: '雪' },
  { key: 'sakura', label: '桜' },
];

const TYPING_OPTIONS: { key: TypingSoundType; label: string }[] = [
  { key: 'none', label: 'なし' },
  { key: 'mechanical', label: '機械式' },
  { key: 'wooden', label: '木製' },
  { key: 'soft', label: '静音' },
];

export function AmbiencePopover() {
  const {
    ambienceEnabled, ambienceSettings, setAmbienceSettings, toggleAmbience,
    soundSettings, setSoundSettings,
  } = useUIStore();
  const updateSound = (patch: Partial<typeof soundSettings>) => {
    setSoundSettings({ ...soundSettings, ...patch });
  };
  // BGMトラック変更はユーザー操作のコールスタック内で直接再生開始（autoplay対策）
  const selectBgm = (trackId: string | null) => {
    if (soundSettings.enabled) {
      soundManager.setBgmTrack(trackId);
    }
    updateSound({ bgmTrack: trackId });
  };

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        width: '340px',
        padding: '16px',
      }}
    >
      {/* 演出セクション */}
      <SectionLabel>演出エフェクト</SectionLabel>
      <div className="flex items-center gap-2 mb-2">
        <MiniToggle checked={ambienceEnabled} onChange={toggleAmbience} />
        <div className="flex gap-1 flex-1">
          {EFFECT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              className="text-xs px-2 py-1 rounded flex-1"
              style={{
                background: ambienceSettings.effectType === opt.key ? 'var(--accent)' : 'var(--bg-deep)',
                color: ambienceSettings.effectType === opt.key ? 'var(--bg-deep)' : 'var(--text-mid)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: ambienceSettings.effectType === opt.key ? 600 : 400,
              }}
              onClick={() => setAmbienceSettings({ ...ambienceSettings, effectType: opt.key })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <Divider />

      {/* サウンドセクション */}
      <SectionLabel>サウンド</SectionLabel>
      <div className="flex items-center gap-2 mb-2">
        <MiniToggle
          checked={soundSettings.enabled}
          onChange={(v) => updateSound({ enabled: v })}
        />
        <SliderRow
          label="マスター"
          value={soundSettings.masterVolume}
          onChange={(v) => updateSound({ masterVolume: v })}
          disabled={!soundSettings.enabled}
        />
      </div>

      <Divider />

      {/* 環境音(BGM) */}
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>環境音</span>
        <select
          className="text-xs flex-1"
          style={{
            background: 'var(--bg-deep)',
            color: 'var(--text-mid)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '2px 4px',
          }}
          value={soundSettings.bgmTrack ?? ''}
          onChange={(e) => selectBgm(e.target.value === '' ? null : e.target.value)}
          disabled={!soundSettings.enabled}
        >
          <option value="">なし</option>
          {BGM_TRACKS.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>
      {soundSettings.bgmTrack !== null && (
        <div className="mt-1">
          <SliderRow
            label="BGM音量"
            value={soundSettings.bgmVolume}
            onChange={(v) => updateSound({ bgmVolume: v })}
            disabled={!soundSettings.enabled}
          />
        </div>
      )}

      <Divider />

      {/* タイピング音 */}
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>打鍵音</span>
        <select
          className="text-xs flex-1"
          style={{
            background: 'var(--bg-deep)',
            color: 'var(--text-mid)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '2px 4px',
          }}
          value={soundSettings.typingType}
          onChange={(e) => updateSound({ typingType: e.target.value as TypingSoundType })}
          disabled={!soundSettings.enabled}
        >
          {TYPING_OPTIONS.map((opt) => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>
      </div>
      {soundSettings.typingType !== 'none' && (
        <div className="mt-1">
          <SliderRow
            label="打鍵音量"
            value={soundSettings.typingVolume}
            onChange={(v) => updateSound({ typingVolume: v })}
            disabled={!soundSettings.enabled}
          />
        </div>
      )}

    </div>
  );
}

// =========================================
// サブコンポーネント
// =========================================

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-medium mb-1" style={{ color: 'var(--text)', letterSpacing: '0.03em' }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="my-2" style={{ borderTop: '1px solid var(--border)', opacity: 0.5 }} />;
}

function MiniToggle({
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
        width: '28px',
        height: '16px',
        borderRadius: '8px',
        background: checked ? 'var(--accent)' : 'var(--bg-deep)',
        border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background 200ms',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '1px',
          left: checked ? '13px' : '1px',
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          background: checked ? 'var(--bg-deep)' : 'var(--text-muted)',
          transition: 'left 200ms',
        }}
      />
    </button>
  );
}

function SliderRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', width: '48px' }}>
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: 'var(--accent)', height: '14px' }}
        disabled={disabled}
      />
      <span className="text-xs" style={{ color: 'var(--text-muted)', width: '28px', textAlign: 'right' }}>
        {Math.round(value * 100)}
      </span>
    </div>
  );
}

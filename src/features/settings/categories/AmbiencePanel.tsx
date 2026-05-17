import { useEffect, useRef } from 'react';
import type { AmbienceSettings, SoundSettings, AmbientType, EffectType, ParticleDensity, TypingSoundType } from '@/shared/stores/uiStore';
import { Row, Section, Toggle, Slider, Chips } from '../atoms';

interface AmbiencePanelProps {
  draftAmbience: AmbienceSettings;
  onAmbienceChange: (patch: Partial<AmbienceSettings>) => void;
  draftSound: SoundSettings;
  onSoundChange: (patch: Partial<SoundSettings>) => void;
}

const EFFECT_OPTIONS: { value: EffectType; label: string }[] = [
  { value: 'rain',   label: '雨' },
  { value: 'snow',   label: '雪' },
  { value: 'sakura', label: '桜' },
];

const DENSITY_OPTIONS: { value: ParticleDensity; label: string }[] = [
  { value: 'sparse', label: '疎' },
  { value: 'normal', label: '普通' },
  { value: 'dense',  label: '密' },
];

const AMBIENT_OPTIONS: { key: AmbientType; label: string; icon: string }[] = [
  { key: 'rain',      label: '雨音',   icon: '☂' },
  { key: 'fireplace', label: '焚き火', icon: '🔥' },
  { key: 'forest',    label: '森・鳥', icon: '🌲' },
  { key: 'cafe',      label: 'カフェ', icon: '☕' },
  { key: 'waves',     label: '波の音', icon: '🌊' },
];

const TYPING_OPTIONS: { value: TypingSoundType; label: string }[] = [
  { value: 'none',       label: 'なし' },
  { value: 'mechanical', label: '機械式' },
  { value: 'wooden',     label: '木製' },
  { value: 'soft',       label: '静音' },
];

// ========== AmbiencePreview ==========

interface PreviewProps {
  effectType: EffectType;
  density: ParticleDensity;
  speed: number;
  angle: number;
  opacity: number;
}

const DENSITY_COUNT = { sparse: 12, normal: 24, dense: 48 };

function AmbiencePreview({ effectType, density, speed, angle, opacity }: PreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const styleId = 'ambience-preview-keyframes';

  useEffect(() => {
    if (!document.getElementById(styleId)) {
      const el = document.createElement('style');
      el.id = styleId;
      el.textContent = `
        @keyframes fall-rain   { from { transform: translateY(-10px); } to { transform: translateY(140px); } }
        @keyframes fall-snow   { from { transform: translateY(-10px) translateX(0px); } to { transform: translateY(140px) translateX(8px); } }
        @keyframes fall-sakura { from { transform: translateY(-10px) rotate(0deg); } to { transform: translateY(140px) rotate(360deg); } }
      `;
      document.head.appendChild(el);
    }
  }, []);

  const count = DENSITY_COUNT[density];
  const duration = 11 - speed; // speed 1→10秒, speed 10→1秒

  const particles = Array.from({ length: count }, (_, i) => {
    const left = Math.random() * 100;
    const delay = Math.random() * duration;
    const animName = `fall-${effectType}`;

    const style: React.CSSProperties = {
      position: 'absolute',
      left: `${left}%`,
      top: 0,
      opacity,
      animation: `${animName} ${duration}s ${delay}s linear infinite`,
      transform: `rotate(${angle}deg)`,
      fontSize: effectType === 'sakura' ? '10px' : undefined,
    };

    if (effectType === 'rain') {
      Object.assign(style, { width: '1px', height: '10px', background: '#aac', borderRadius: '1px' });
    } else if (effectType === 'snow') {
      Object.assign(style, { width: '4px', height: '4px', background: 'white', borderRadius: '50%' });
    }

    return (
      <div key={i} style={style}>
        {effectType === 'sakura' ? '✿' : null}
      </div>
    );
  });

  return (
    <div
      ref={containerRef}
      style={{
        width: '140px',
        height: '100px',
        borderRadius: '6px',
        background: 'var(--bg-deep)',
        border: '1px solid var(--border)',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {particles}
    </div>
  );
}

// ========== AmbiencePanel ==========

export function AmbiencePanel({ draftAmbience, onAmbienceChange, draftSound, onSoundChange }: AmbiencePanelProps) {
  const soundEnabled = draftSound.enabled;

  const toggleAmbient = (type: AmbientType) => {
    const active = draftSound.activeAmbients.includes(type)
      ? draftSound.activeAmbients.filter((t) => t !== type)
      : [...draftSound.activeAmbients, type];
    onSoundChange({ activeAmbients: active });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 演出（ビジュアル） */}
      <Section title="演出（ビジュアル）">
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          <AmbiencePreview
            effectType={draftAmbience.effectType}
            density={draftAmbience.density}
            speed={draftAmbience.speed}
            angle={draftAmbience.angle}
            opacity={draftAmbience.opacity}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            <Row label="効果">
              <Chips options={EFFECT_OPTIONS} value={draftAmbience.effectType} onChange={(v) => onAmbienceChange({ effectType: v })} />
            </Row>
            <Row label="密度">
              <Chips options={DENSITY_OPTIONS} value={draftAmbience.density} onChange={(v) => onAmbienceChange({ density: v })} />
            </Row>
          </div>
        </div>
        <Row label="速度">
          <Slider value={draftAmbience.speed} onChange={(v) => onAmbienceChange({ speed: v })} min={1} max={10} />
        </Row>
        <Row label="角度">
          <Slider value={draftAmbience.angle} onChange={(v) => onAmbienceChange({ angle: v })} min={-30} max={30} step={5} format={(v) => `${v}°`} />
        </Row>
        <Row label="透明度">
          <Slider value={draftAmbience.opacity} onChange={(v) => onAmbienceChange({ opacity: v })} min={0.1} max={0.8} step={0.05} format={(v) => `${Math.round(v * 100)}%`} />
        </Row>
      </Section>

      {/* サウンド全体 */}
      <Section title="サウンド">
        <Row label="サウンド全体">
          <Toggle checked={soundEnabled} onChange={(v) => onSoundChange({ enabled: v })} />
        </Row>
        <Row label="マスターボリューム">
          <Slider
            value={draftSound.masterVolume}
            onChange={(v) => onSoundChange({ masterVolume: v })}
            min={0} max={1} step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            disabled={!soundEnabled}
          />
        </Row>
      </Section>

      {/* 環境音 */}
      <Section title="環境音" collapsed={!soundEnabled}>
        <Row label="音量">
          <Slider
            value={draftSound.ambientVolume}
            onChange={(v) => onSoundChange({ ambientVolume: v })}
            min={0} max={1} step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </Row>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {AMBIENT_OPTIONS.map((opt) => {
            const active = draftSound.activeAmbients.includes(opt.key);
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => toggleAmbient(opt.key)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--bg-elevated)' : 'var(--bg-deep)',
                  cursor: 'pointer',
                  transition: 'border-color 150ms, background 150ms',
                }}
              >
                <span style={{ fontSize: '20px' }}>{opt.icon}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-mid)' }}>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* タイピング音 */}
      <Section title="タイピング音" collapsed={!soundEnabled}>
        <Row label="種類">
          <Chips options={TYPING_OPTIONS} value={draftSound.typingType} onChange={(v) => onSoundChange({ typingType: v })} />
        </Row>
        <Row label="音量">
          <Slider
            value={draftSound.typingVolume}
            onChange={(v) => onSoundChange({ typingVolume: v })}
            min={0} max={1} step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            disabled={draftSound.typingType === 'none'}
          />
        </Row>
      </Section>
    </div>
  );
}

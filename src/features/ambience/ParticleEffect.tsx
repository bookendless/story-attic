import { useRef, useEffect, useCallback } from 'react';
import { useUIStore, type ParticleDensity, type EffectType } from '@/shared/stores/uiStore';

// =========================================
// 定数・型
// =========================================

/** 密度ごとのパーティクル数 */
const DENSITY_MAP: Record<ParticleDensity, number> = {
  sparse: 80,
  normal: 200,
  dense: 500,
};

/** 桜は雨より少なめの方が自然 */
const SAKURA_DENSITY_MAP: Record<ParticleDensity, number> = {
  sparse: 20,
  normal: 50,
  dense: 120,
};

/** 雪は中間 */
const SNOW_DENSITY_MAP: Record<ParticleDensity, number> = {
  sparse: 40,
  normal: 100,
  dense: 250,
};

/** 共通パーティクルデータ */
interface Particle {
  x: number;
  y: number;
  speed: number;
  size: number;
  opacity: number;
  /** 雪・桜用: 横揺れフェーズ */
  phase: number;
  /** 桜用: 回転角度 */
  rotation: number;
  /** 桜用: 回転速度 */
  rotSpeed: number;
}

// =========================================
// パーティクル生成
// =========================================

function createParticle(
  w: number, h: number, effectType: EffectType, baseSpeed: number,
): Particle {
  const common = {
    x: Math.random() * w,
    y: Math.random() * h,
    opacity: 0.15 + Math.random() * 0.35,
    phase: Math.random() * Math.PI * 2,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: 0,
  };

  switch (effectType) {
    case 'rain':
      return {
        ...common,
        speed: baseSpeed * (0.6 + Math.random() * 0.8),
        size: (8 + baseSpeed * 2) * (0.5 + Math.random() * 0.7), // length
      };
    case 'snow':
      return {
        ...common,
        speed: baseSpeed * (0.2 + Math.random() * 0.4), // 雪はゆっくり
        size: 2 + Math.random() * 4, // 半径
      };
    case 'sakura':
      return {
        ...common,
        speed: baseSpeed * (0.15 + Math.random() * 0.3), // 桜もゆっくり
        size: 4 + Math.random() * 5, // 花びらサイズ
        rotSpeed: (Math.random() - 0.5) * 0.04,
      };
  }
}

// =========================================
// テーマ別カラー取得
// =========================================

/** ダーク/ライトテーマに応じた描画色を返す */
function getColors(effectType: EffectType, isDark: boolean) {
  switch (effectType) {
    case 'rain':
      return isDark
        ? { r: 180, g: 200, b: 220 }  // 明るい青灰色（暗背景用）
        : { r: 60, g: 80, b: 110 };    // 暗い青灰色（明背景用）
    case 'snow':
      return isDark
        ? { r: 230, g: 240, b: 255 }   // 白に近い青み
        : { r: 140, g: 160, b: 190 };   // 少し暗めの灰青
    case 'sakura':
      return isDark
        ? { r: 255, g: 180, b: 200 }   // ピンク
        : { r: 220, g: 100, b: 130 };   // 濃いめのピンク
  }
}

// =========================================
// 描画関数
// =========================================

function drawRain(
  ctx: CanvasRenderingContext2D, p: Particle, color: { r: number; g: number; b: number },
  globalOpacity: number, dx: number,
) {
  const alpha = p.opacity * globalOpacity;
  ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + dx * p.size, p.y + p.size);
  ctx.stroke();
}

function drawSnow(
  ctx: CanvasRenderingContext2D, p: Particle, color: { r: number; g: number; b: number },
  globalOpacity: number,
) {
  const alpha = p.opacity * globalOpacity;
  ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
  ctx.fill();
}

function drawSakura(
  ctx: CanvasRenderingContext2D, p: Particle, color: { r: number; g: number; b: number },
  globalOpacity: number,
) {
  const alpha = p.opacity * globalOpacity;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);

  // 花びら形状: 2つの楕円を重ねる
  const s = p.size;
  ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(0, 0, s, s * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 少し明るい内側のハイライト
  ctx.fillStyle = `rgba(${Math.min(color.r + 40, 255)}, ${Math.min(color.g + 40, 255)}, ${Math.min(color.b + 20, 255)}, ${alpha * 0.5})`;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.1, s * 0.5, s * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// =========================================
// メインコンポーネント
// =========================================

/**
 * パーティクル演出コンポーネント
 * 雨・雪・桜のアニメーションをCanvasで描画する。
 */
export function ParticleEffect() {
  const ambienceEnabled = useUIStore((s) => s.ambienceEnabled);
  const ambienceSettings = useUIStore((s) => s.ambienceSettings);
  const theme = useUIStore((s) => s.theme);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animIdRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const visibleRef = useRef(true);
  const timeRef = useRef(0);

  /** Canvas のサイズを親要素に合わせる（高DPI対応） */
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  /** パーティクルプールを再生成する */
  const initParticles = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    const { effectType, density, speed } = ambienceSettings;
    const densityMap =
      effectType === 'sakura' ? SAKURA_DENSITY_MAP :
      effectType === 'snow' ? SNOW_DENSITY_MAP :
      DENSITY_MAP;
    const count = densityMap[density];
    const baseSpeed = 2 + speed * 1.2;
    particlesRef.current = Array.from({ length: count }, () =>
      createParticle(w, h, effectType, baseSpeed),
    );
  }, [ambienceSettings]);

  useEffect(() => {
    if (!ambienceEnabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    resizeCanvas();
    initParticles();
    timeRef.current = 0;

    const { effectType, angle, opacity: globalOpacity, speed } = ambienceSettings;
    const angleRad = (angle * Math.PI) / 180;
    const dx = Math.sin(angleRad);
    const isDark = theme === 'dark';
    const color = getColors(effectType, isDark);

    const tick = () => {
      if (!visibleRef.current) {
        animIdRef.current = requestAnimationFrame(tick);
        return;
      }
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      timeRef.current += 1;

      ctx.clearRect(0, 0, w, h);

      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // 描画
        switch (effectType) {
          case 'rain':
            drawRain(ctx, p, color, globalOpacity, dx);
            break;
          case 'snow':
            drawSnow(ctx, p, color, globalOpacity);
            break;
          case 'sakura':
            drawSakura(ctx, p, color, globalOpacity);
            break;
        }

        // 移動
        switch (effectType) {
          case 'rain':
            p.x += dx * p.speed;
            p.y += p.speed;
            break;
          case 'snow': {
            // 横揺れ（サイン波）
            const sway = Math.sin(p.phase + timeRef.current * 0.02) * 0.5;
            p.x += dx * p.speed + sway;
            p.y += p.speed;
            break;
          }
          case 'sakura': {
            // 風に舞うような横揺れ + 回転
            const windSway = Math.sin(p.phase + timeRef.current * 0.015) * (0.3 + speed * 0.1);
            p.x += dx * p.speed + windSway;
            p.y += p.speed;
            p.rotation += p.rotSpeed;
            break;
          }
        }

        // 画面外に出たら上に戻す
        if (p.y > h + p.size || p.x < -30 || p.x > w + 30) {
          p.x = Math.random() * w;
          p.y = -p.size - Math.random() * 20;
          p.rotation = Math.random() * Math.PI * 2;
        }
      }

      animIdRef.current = requestAnimationFrame(tick);
    };

    animIdRef.current = requestAnimationFrame(tick);

    const handleVisibility = () => {
      visibleRef.current = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const ro = new ResizeObserver(() => {
      resizeCanvas();
      initParticles();
    });
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    return () => {
      cancelAnimationFrame(animIdRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
      ro.disconnect();
    };
  }, [ambienceEnabled, ambienceSettings, theme, resizeCanvas, initParticles]);

  if (!ambienceEnabled) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
}

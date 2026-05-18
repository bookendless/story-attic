/**
 * Lamp — 執筆フェーズの「見守り中」呼吸ランプ
 */
interface LampProps {
  size?: number;
  accent: string;
}

export function Lamp({ size = 14, accent }: LampProps) {
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          inset: -8,
          background: `radial-gradient(circle, ${accent} 0%, transparent 65%)`,
          opacity: 0.45,
          animation: 'lampRadial 4.5s ease-in-out infinite',
          borderRadius: '50%',
        }}
      />
      <span
        aria-hidden
        style={{
          width: size * 0.6,
          height: size * 0.6,
          borderRadius: '50%',
          background: accent,
          boxShadow: `0 0 ${size * 0.6}px ${accent}`,
          animation: 'lampBreath 4.5s ease-in-out infinite',
        }}
      />
    </span>
  );
}

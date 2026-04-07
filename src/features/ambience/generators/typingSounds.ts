/**
 * タイピング音生成
 * 短いノイズバーストをフィルタで成形し、キーボード打鍵音を再現する。
 */

export type TypingSoundType = 'mechanical' | 'wooden' | 'soft' | 'none';

export const TYPING_LABELS: Record<TypingSoundType, string> = {
  mechanical: '機械式キーボード',
  wooden: '木製キーボード',
  soft: '静音',
  none: 'なし',
};

/** タイピング音のバッファを事前生成する */
export function createTypingBuffer(
  ctx: AudioContext,
  type: TypingSoundType,
): AudioBuffer | null {
  if (type === 'none') return null;

  const sampleRate = ctx.sampleRate;
  // 打鍵音の長さ（ミリ秒）
  const durationMs = type === 'wooden' ? 60 : type === 'mechanical' ? 40 : 30;
  const length = Math.floor(sampleRate * durationMs / 1000);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    const t = i / length; // 0 ~ 1 正規化時間
    const noise = Math.random() * 2 - 1;
    // 指数減衰エンベロープ
    const envelope = Math.exp(-t * (type === 'soft' ? 12 : 8));

    switch (type) {
      case 'mechanical':
        // 高域寄りのクリック感
        data[i] = noise * envelope * 0.5;
        break;
      case 'wooden':
        // 中域寄りの柔らかいタップ
        data[i] = noise * envelope * 0.4 * Math.sin(t * Math.PI * 6);
        break;
      case 'soft':
        // ごく短い微かなタップ
        data[i] = noise * envelope * 0.2;
        break;
    }
  }

  return buffer;
}

/** タイピング音を1回再生する */
export function playTypingSound(
  ctx: AudioContext,
  buffer: AudioBuffer,
  destination: AudioNode,
) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  // ピッチを少しランダムに変える（自然さの演出）
  source.playbackRate.value = 0.9 + Math.random() * 0.2;
  source.connect(destination);
  source.start();
}

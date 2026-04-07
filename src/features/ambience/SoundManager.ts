/**
 * サウンド管理シングルトン
 * MP3ファイルを読み込み、環境音のループ再生・タイピング音を制御する。
 * AudioContext はユーザー操作時に遅延初期化する（autoplay policy 対策）。
 */

import {
  createTypingBuffer,
  playTypingSound,
  type TypingSoundType,
} from './generators/typingSounds';

/** 環境音の種類とファイルパスの対応 */
const AMBIENT_FILES: Record<string, string> = {
  rain: '/sounds/rain.mp3',
  fireplace: '/sounds/fireplace.mp3',
  forest: '/sounds/forest.mp3',
  cafe: '/sounds/cafe.mp3',
  waves: '/sounds/waves.mp3',
};

/** アクティブな環境音の管理情報 */
interface ActiveAmbient {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

class SoundManagerImpl {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private typingGain: GainNode | null = null;

  /** デコード済みバッファのキャッシュ */
  private bufferCache = new Map<string, AudioBuffer>();
  private activeAmbients = new Map<string, ActiveAmbient>();
  private typingBuffer: AudioBuffer | null = null;
  private typingType: TypingSoundType = 'none';
  private muted = false;

  /** AudioContext を遅延初期化する */
  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.connect(this.masterGain);

      this.typingGain = this.ctx.createGain();
      this.typingGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /** MP3ファイルを読み込み、デコードしてキャッシュする */
  private async loadBuffer(url: string): Promise<AudioBuffer | null> {
    if (this.bufferCache.has(url)) {
      return this.bufferCache.get(url)!;
    }
    const ctx = this.ensureContext();
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      this.bufferCache.set(url, audioBuffer);
      return audioBuffer;
    } catch (e) {
      console.error(`音源の読み込みに失敗: ${url}`, e);
      return null;
    }
  }

  // =========================================
  // マスター制御
  // =========================================

  setMasterVolume(volume: number) {
    this.ensureContext();
    if (this.masterGain) {
      this.masterGain.gain.value = volume;
    }
  }

  muteAll() {
    this.muted = true;
    if (this.masterGain) {
      this.masterGain.gain.value = 0;
    }
  }

  unmuteAll(volume: number) {
    this.muted = false;
    if (this.masterGain) {
      this.masterGain.gain.value = volume;
    }
  }

  get isMuted() {
    return this.muted;
  }

  // =========================================
  // 環境音制御
  // =========================================

  /** 環境音を開始する */
  async startAmbient(type: string, volume: number) {
    if (this.activeAmbients.has(type)) return;

    const url = AMBIENT_FILES[type];
    if (!url) return;

    const ctx = this.ensureContext();
    if (!this.ambientGain) return;

    const buffer = await this.loadBuffer(url);
    if (!buffer) return;

    // 再生が既に開始されている場合（非同期の間に重複呼び出し）
    if (this.activeAmbients.has(type)) return;

    const gain = ctx.createGain();
    gain.gain.value = volume;
    gain.connect(this.ambientGain);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start();

    this.activeAmbients.set(type, { source, gain });
  }

  /** 環境音を停止する */
  stopAmbient(type: string) {
    const active = this.activeAmbients.get(type);
    if (!active) return;
    try {
      active.source.stop();
    } catch {
      /* 既に停止済み */
    }
    active.gain.disconnect();
    this.activeAmbients.delete(type);
  }

  /** 環境音のボリュームを変更する */
  setAmbientVolume(type: string, volume: number) {
    const active = this.activeAmbients.get(type);
    if (active) {
      active.gain.gain.value = volume;
    }
  }

  /** 環境音全体のボリュームを変更する */
  setAmbientMasterVolume(volume: number) {
    this.ensureContext();
    if (this.ambientGain) {
      this.ambientGain.gain.value = volume;
    }
  }

  /** 全環境音を停止する */
  stopAllAmbients() {
    for (const type of this.activeAmbients.keys()) {
      this.stopAmbient(type);
    }
  }

  /** 特定の環境音が再生中か */
  isAmbientPlaying(type: string): boolean {
    return this.activeAmbients.has(type);
  }

  // =========================================
  // タイピング音制御
  // =========================================

  setTypingType(type: TypingSoundType) {
    this.typingType = type;
    this.typingBuffer = null;
  }

  setTypingVolume(volume: number) {
    this.ensureContext();
    if (this.typingGain) {
      this.typingGain.gain.value = volume;
    }
  }

  playTyping() {
    if (this.typingType === 'none' || this.muted) return;

    const ctx = this.ensureContext();
    if (!this.typingGain) return;

    if (!this.typingBuffer) {
      this.typingBuffer = createTypingBuffer(ctx, this.typingType);
    }
    if (!this.typingBuffer) return;

    playTypingSound(ctx, this.typingBuffer, this.typingGain);
  }

  // =========================================
  // クリーンアップ
  // =========================================

  dispose() {
    this.stopAllAmbients();
    this.bufferCache.clear();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
      this.ambientGain = null;
      this.typingGain = null;
    }
    this.typingBuffer = null;
  }
}

/** グローバルシングルトンインスタンス */
export const soundManager = new SoundManagerImpl();

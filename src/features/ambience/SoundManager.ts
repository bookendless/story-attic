import {
  createTypingBuffer,
  playTypingSound,
  type TypingSoundType,
} from './generators/typingSounds';
import { findBgmTrack } from './generators/bgmTracks';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

class SoundManagerImpl {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private typingGain: GainNode | null = null;

  private typingBuffer: AudioBuffer | null = null;
  private typingType: TypingSoundType = 'none';
  private muted = false;

  // BGM（HTMLAudioElement ベース・AudioContext とは独立）
  private bgmAudio: HTMLAudioElement | null = null;
  private bgmTrackId: string | null = null;
  private masterVolume = 0.5;
  private bgmVolume = 0.5;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);

      this.typingGain = this.ctx.createGain();
      this.typingGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  setMasterVolume(volume: number) {
    this.ensureContext();
    this.masterVolume = volume;
    if (this.masterGain) {
      this.masterGain.gain.value = volume;
    }
    this.applyBgmVolume();
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

  // ===== BGM =====

  /** 再生中BGMの音量を master * bgm で適用 */
  private applyBgmVolume() {
    if (this.bgmAudio) {
      this.bgmAudio.volume = clamp01(this.masterVolume * this.bgmVolume);
    }
  }

  setBgmVolume(volume: number) {
    this.bgmVolume = volume;
    this.applyBgmVolume();
  }

  /**
   * BGMトラックを切り替える。null で停止。
   * 自動再生ポリシー対策のため、ユーザー操作のコールスタック内から呼ぶこと。
   */
  setBgmTrack(trackId: string | null) {
    if (trackId === this.bgmTrackId) return;
    this.bgmTrackId = trackId;

    if (!trackId) {
      if (this.bgmAudio) {
        this.bgmAudio.pause();
        this.bgmAudio.src = '';
      }
      return;
    }

    const track = findBgmTrack(trackId);
    if (!track) {
      this.bgmTrackId = null;
      return;
    }

    if (!this.bgmAudio) {
      this.bgmAudio = new Audio();
      this.bgmAudio.loop = true;
    }
    this.bgmAudio.src = track.src;
    this.applyBgmVolume();
    // play() は autoplay 制約で拒否されることがあるため握りつぶす
    this.bgmAudio.play().catch(() => { /* ユーザー操作後の再試行に委ねる */ });
  }

  get currentBgmTrack() {
    return this.bgmTrackId;
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

  dispose() {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
      this.typingGain = null;
    }
    this.typingBuffer = null;
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio.src = '';
      this.bgmAudio = null;
    }
    this.bgmTrackId = null;
  }
}

/** グローバルシングルトンインスタンス */
export const soundManager = new SoundManagerImpl();

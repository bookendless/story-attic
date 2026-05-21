import {
  createTypingBuffer,
  playTypingSound,
  type TypingSoundType,
} from './generators/typingSounds';

class SoundManagerImpl {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private typingGain: GainNode | null = null;

  private typingBuffer: AudioBuffer | null = null;
  private typingType: TypingSoundType = 'none';
  private muted = false;

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

  dispose() {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
      this.typingGain = null;
    }
    this.typingBuffer = null;
  }
}

/** グローバルシングルトンインスタンス */
export const soundManager = new SoundManagerImpl();

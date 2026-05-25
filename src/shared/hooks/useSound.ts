import { useEffect } from 'react';
import { useUIStore } from '@/shared/stores/uiStore';
import { soundManager } from '@/features/ambience/SoundManager';

export function useSound() {
  const soundSettings = useUIStore((s) => s.soundSettings);

  useEffect(() => {
    const { enabled, masterVolume, typingType, typingVolume, bgmTrack, bgmVolume } = soundSettings;

    soundManager.setMasterVolume(enabled ? masterVolume : 0);
    soundManager.setTypingType(typingType);
    soundManager.setTypingVolume(typingVolume);
    soundManager.setBgmVolume(bgmVolume);
    // 無効時は停止。再生開始(play)は autoplay 制約のため UI 操作起点でも行うが、
    // ここでは状態同期としてトラック反映を試みる（拒否時は SoundManager 側で握る）。
    soundManager.setBgmTrack(enabled ? bgmTrack : null);
  }, [soundSettings]);

  useEffect(() => {
    return () => {
      soundManager.dispose();
    };
  }, []);
}

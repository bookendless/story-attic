import { useEffect } from 'react';
import { useUIStore } from '@/shared/stores/uiStore';
import { soundManager } from '@/features/ambience/SoundManager';

export function useSound() {
  const soundSettings = useUIStore((s) => s.soundSettings);

  useEffect(() => {
    const { enabled, masterVolume, typingType, typingVolume } = soundSettings;

    soundManager.setMasterVolume(enabled ? masterVolume : 0);
    soundManager.setTypingType(typingType);
    soundManager.setTypingVolume(typingVolume);
  }, [soundSettings]);

  useEffect(() => {
    return () => {
      soundManager.dispose();
    };
  }, []);
}

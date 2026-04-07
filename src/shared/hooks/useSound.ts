/**
 * サウンド設定とSoundManagerを同期するフック
 * soundSettings の変更を監視し、環境音の開始/停止・ボリューム変更を行う。
 */

import { useEffect, useRef } from 'react';
import { useUIStore, type AmbientType } from '@/shared/stores/uiStore';
import { soundManager } from '@/features/ambience/SoundManager';

export function useSound() {
  const soundSettings = useUIStore((s) => s.soundSettings);
  const prevAmbientsRef = useRef<AmbientType[]>([]);

  useEffect(() => {
    const { enabled, masterVolume, ambientVolume, activeAmbients, typingType, typingVolume } = soundSettings;

    // マスターボリューム
    soundManager.setMasterVolume(enabled ? masterVolume : 0);

    if (!enabled) {
      soundManager.stopAllAmbients();
      prevAmbientsRef.current = [];
      return;
    }

    // 環境音全体のボリューム
    soundManager.setAmbientMasterVolume(ambientVolume);

    // 環境音の差分更新: 停止すべきもの
    const prev = prevAmbientsRef.current;
    for (const type of prev) {
      if (!activeAmbients.includes(type)) {
        soundManager.stopAmbient(type);
      }
    }
    // 開始すべきもの
    for (const type of activeAmbients) {
      if (!soundManager.isAmbientPlaying(type)) {
        soundManager.startAmbient(type, 0.5);
      }
    }
    prevAmbientsRef.current = [...activeAmbients];

    // タイピング音
    soundManager.setTypingType(typingType);
    soundManager.setTypingVolume(typingVolume);
  }, [soundSettings]);

  // アンマウント時にクリーンアップ
  useEffect(() => {
    return () => {
      soundManager.stopAllAmbients();
    };
  }, []);
}

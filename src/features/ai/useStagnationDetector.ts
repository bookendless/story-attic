/**
 * Writer Block Detection Engine — 停滞検知フック
 * editorStoreのbody変化を監視し、3種類の停滞を検知してaiStoreに通知する。
 * writeフェーズ中のみ動作する。
 */

import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/shared/stores/editorStore';
import { useAiStore } from '@/shared/stores/aiStore';
import type { BlockType } from '@/shared/types';

const IDEA_BLOCK_IDLE_MS = 10 * 60 * 1000;
const IDEA_CHECK_INTERVAL_MS = 60 * 1000;
const LARGE_DELETE_THRESHOLD = 300;
const STRUCTURE_HISTORY_SIZE = 10;
const STRUCTURE_RANGE_THRESHOLD = 200;
const BLOCK_DWELL_MS = 30 * 1000;
const TYPING_HISTORY_SIZE = 20;
const MOTIVATION_STDDEV_THRESHOLD = 3000;
const MOTIVATION_MEAN_THRESHOLD = 2000;

export function useStagnationDetector() {
  const phase = useAiStore((s) => s.phase);
  const setDetectedBlock = useAiStore((s) => s.setDetectedBlock);

  const lastInputTime = useRef<number>(Date.now());
  const bodyLengthHistory = useRef<number[]>([]);
  const keyIntervalHistory = useRef<number[]>([]);
  const blockDwellTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingBlock = useRef<BlockType>('none');

  useEffect(() => {
    if (phase !== 'write') {
      setDetectedBlock('none');
      if (blockDwellTimer.current) {
        clearTimeout(blockDwellTimer.current);
        blockDwellTimer.current = null;
      }
      pendingBlock.current = 'none';
      return;
    }

    const schedulePendingBlock = (block: Exclude<BlockType, 'none'>) => {
      if (pendingBlock.current === block) return;
      pendingBlock.current = block;
      if (blockDwellTimer.current) clearTimeout(blockDwellTimer.current);
      blockDwellTimer.current = setTimeout(() => {
        setDetectedBlock(block);
        pendingBlock.current = 'none';
      }, BLOCK_DWELL_MS);
    };

    const cancelPendingBlock = () => {
      if (blockDwellTimer.current) {
        clearTimeout(blockDwellTimer.current);
        blockDwellTimer.current = null;
      }
      pendingBlock.current = 'none';
    };

    const unsubscribe = useEditorStore.subscribe((state, prevState) => {
      const body = state.currentEpisode?.body;
      const prevBody = prevState.currentEpisode?.body;
      if (body === undefined || body === prevBody) return;

      const now = Date.now();
      const elapsed = now - lastInputTime.current;
      lastInputTime.current = now;

      const currentLen = body.length;
      const prevLen = prevBody?.length ?? currentLen;
      const delta = currentLen - prevLen;

      if (elapsed < 5000 && elapsed > 0) {
        keyIntervalHistory.current = [
          ...keyIntervalHistory.current.slice(-(TYPING_HISTORY_SIZE - 1)),
          elapsed,
        ];
      }

      if (delta < -LARGE_DELETE_THRESHOLD) {
        schedulePendingBlock('structure');
        return;
      }

      bodyLengthHistory.current = [
        ...bodyLengthHistory.current.slice(-(STRUCTURE_HISTORY_SIZE - 1)),
        currentLen,
      ];
      if (bodyLengthHistory.current.length >= STRUCTURE_HISTORY_SIZE) {
        const max = Math.max(...bodyLengthHistory.current);
        const min = Math.min(...bodyLengthHistory.current);
        if (max - min < STRUCTURE_RANGE_THRESHOLD) {
          schedulePendingBlock('structure');
          return;
        }
      }

      if (keyIntervalHistory.current.length >= TYPING_HISTORY_SIZE) {
        const mean =
          keyIntervalHistory.current.reduce((a, b) => a + b, 0) /
          keyIntervalHistory.current.length;
        const variance =
          keyIntervalHistory.current.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
          keyIntervalHistory.current.length;
        const stddev = Math.sqrt(variance);
        if (stddev > MOTIVATION_STDDEV_THRESHOLD && mean > MOTIVATION_MEAN_THRESHOLD) {
          schedulePendingBlock('motivation');
          return;
        }
      }

      cancelPendingBlock();
    });

    const ideaTimer = setInterval(() => {
      const idleMs = Date.now() - lastInputTime.current;
      if (idleMs >= IDEA_BLOCK_IDLE_MS && pendingBlock.current === 'none') {
        schedulePendingBlock('idea');
      }
    }, IDEA_CHECK_INTERVAL_MS);

    return () => {
      unsubscribe();
      clearInterval(ideaTimer);
      if (blockDwellTimer.current) clearTimeout(blockDwellTimer.current);
    };
  }, [phase, setDetectedBlock]);
}

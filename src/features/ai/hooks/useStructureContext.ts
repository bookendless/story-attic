/**
 * useStructureContext — 構造フェーズ「いまの位置」カード用のデータ集約。
 * 現在の章（タイトル・字数）と伏線の設置/回収数を返す。
 */
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/shared/stores/appStore';
import { useEditorStore } from '@/shared/stores/editorStore';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import type { PlotThread, PlotThreadData } from '@/shared/types';

export interface StructureContext {
  episodeTitle: string;
  charCount: number;
  /** 設置済み伏線数（status: planted / hinted） */
  planted: number;
  /** 回収済み伏線数（status: resolved） */
  resolved: number;
  /** 伏線の総数 */
  total: number;
}

export function useStructureContext(): StructureContext {
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const currentEpisode = useEditorStore((s) => s.currentEpisode);
  const [counts, setCounts] = useState({ planted: 0, resolved: 0, total: 0 });

  useEffect(() => {
    if (!currentProjectId) {
      setCounts({ planted: 0, resolved: 0, total: 0 });
      return;
    }
    let cancelled = false;
    invoke<unknown[]>('get_plot_threads', { projectId: currentProjectId })
      .then((raw) => {
        if (cancelled) return;
        const threads = toCamelCase<PlotThread[]>(raw);
        let planted = 0;
        let resolved = 0;
        for (const t of threads) {
          let status = '';
          try {
            const d: Partial<PlotThreadData> = JSON.parse(t.data || '{}');
            status = d.status ?? '';
          } catch { /* パース失敗は無視 */ }
          if (status === 'planted' || status === 'hinted') planted += 1;
          else if (status === 'resolved') resolved += 1;
        }
        setCounts({ planted, resolved, total: threads.length });
      })
      .catch(() => {
        if (!cancelled) setCounts({ planted: 0, resolved: 0, total: 0 });
      });
    return () => { cancelled = true; };
  }, [currentProjectId, currentEpisode?.id]);

  return {
    episodeTitle: currentEpisode?.title ?? '（章が未選択）',
    charCount: currentEpisode?.charCount ?? 0,
    ...counts,
  };
}

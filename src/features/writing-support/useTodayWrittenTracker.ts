/**
 * 今日の執筆量トラッカー
 * currentEpisode.body の変化を監視し、その日最初に見た字数を基準値として
 * 差分（今日書いた字数）をエピソード横断で uiStore に集計する。
 * あわせて再開情報（最終エピソード・執筆量）も更新する。
 * localStorage への書き込みを抑えるため、集計はキー入力から500msのdebounceで確定する。
 */

import { useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '@/shared/stores/editorStore';
import { useUIStore } from '@/shared/stores/uiStore';
import { saveResumeActivity } from '@/shared/utils/resumeSession';

/** HTMLタグを除去したプレーンテキストの文字数 */
function plainLength(html: string): number {
  return html.replace(/<[^>]+>/g, '').length;
}

/** debounce間隔（ms）。キー入力が止まってからこの時間後に集計を確定する */
const FLUSH_DELAY_MS = 500;

export function useTodayWrittenTracker(projectId: string | null) {
  const currentEpisode = useEditorStore((s) => s.currentEpisode);
  const todayWrittenChars = useUIStore((s) => s.todayWrittenChars);

  const pendingRef = useRef<{ episodeId: string; chars: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEpisodeIdRef = useRef<string | null>(null);

  const flushPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) useUIStore.getState().updateTodayWritten(pending.episodeId, pending.chars);
  }, []);

  // 本文変化 → 今日の執筆量を更新
  useEffect(() => {
    if (!currentEpisode) return;
    const chars = plainLength(currentEpisode.body);

    // エピソードが替わったら前エピソードの計測を先に確定し、
    // 新しいエピソードは即時反映して当日基準値を取りこぼさない
    if (lastEpisodeIdRef.current !== currentEpisode.id) {
      flushPending();
      lastEpisodeIdRef.current = currentEpisode.id;
      useUIStore.getState().updateTodayWritten(currentEpisode.id, chars);
      return;
    }

    pendingRef.current = { episodeId: currentEpisode.id, chars };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flushPending, FLUSH_DELAY_MS);
  }, [currentEpisode, flushPending]);

  // アンマウント時に未確定分を反映
  useEffect(() => flushPending, [flushPending]);

  // 執筆量・最終エピソードを再開情報に反映（字数が確定したときだけ書き込む）
  const episodeId = currentEpisode?.id ?? null;
  useEffect(() => {
    if (!projectId || !episodeId) return;
    saveResumeActivity(projectId, episodeId, todayWrittenChars);
  }, [projectId, episodeId, todayWrittenChars]);
}

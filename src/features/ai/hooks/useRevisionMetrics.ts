/**
 * useRevisionMetrics — 改稿フェーズ「読み直しメトリクス」用のデータ集約。
 * 文字数・推定読了時間・文体ばらつきを現在の章から算出する。
 */
import { useEditorStore } from '@/shared/stores/editorStore';

export type VarianceLevel = '低' | '中' | '高';

export interface RevisionMetrics {
  episodeTitle: string;
  charCount: number;
  /** 推定読了時間（分）。平均読速 250 字/分。 */
  readMinutes: number;
  /** 文体ばらつき（文長の標準偏差を 3 段階に分類） */
  variance: VarianceLevel;
}

const CHARS_PER_MINUTE = 250;

/** 文体ばらつき: 文長の標準偏差を低/中/高に分類 */
function computeVariance(body: string): VarianceLevel {
  const sentences = body
    .split(/[。！？\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (sentences.length < 2) return '低';
  const lengths = sentences.map((s) => s.length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length;
  const stddev = Math.sqrt(variance);
  if (stddev < 10) return '低';
  if (stddev < 20) return '中';
  return '高';
}

export function useRevisionMetrics(): RevisionMetrics {
  const currentEpisode = useEditorStore((s) => s.currentEpisode);
  const charCount = currentEpisode?.charCount ?? 0;

  return {
    episodeTitle: currentEpisode?.title ?? '（章が未選択）',
    charCount,
    readMinutes: Math.max(1, Math.round(charCount / CHARS_PER_MINUTE)),
    variance: computeVariance(currentEpisode?.body ?? ''),
  };
}

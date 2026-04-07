import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useUIStore } from '@/shared/stores/uiStore';
import { useEditorStore } from '@/shared/stores/editorStore';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import type { AnalysisResult } from '@/shared/types';

export function AnalysisModal() {
  const { analysisModalVisible, toggleAnalysisModal } = useUIStore();
  const currentEpisode = useEditorStore((s) => s.currentEpisode);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!analysisModalVisible || !currentEpisode) return;

    setLoading(true);
    setError(null);
    invoke<unknown>('analyze_text', { text: currentEpisode.body })
      .then((raw) => setResult(toCamelCase<AnalysisResult>(raw)))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [analysisModalVisible, currentEpisode]);

  if (!analysisModalVisible) return null;

  return (
    <div className="modal-overlay" onClick={toggleAnalysisModal}>
      <div
        className="modal-box"
        style={{ maxWidth: '640px', maxHeight: '80vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-base font-medium"
            style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}
          >
            文章分析
          </h2>
          <button
            className="btn btn-ghost text-xs"
            onClick={toggleAnalysisModal}
          >
            閉じる
          </button>
        </div>

        {loading && (
          <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
            分析中...
          </div>
        )}

        {error && (
          <div className="text-sm py-4" style={{ color: 'var(--danger)' }}>
            エラー: {error}
          </div>
        )}

        {result && !loading && (
          <div className="space-y-5">
            {/* 基本統計 */}
            <Section title="基本統計">
              <div className="grid grid-cols-4 gap-3">
                <StatCard label="文字数" value={result.charCount.toLocaleString()} />
                <StatCard label="行数" value={result.lineCount.toLocaleString()} />
                <StatCard label="段落数" value={result.paragraphCount.toLocaleString()} />
                <StatCard label="文数" value={result.sentenceCount.toLocaleString()} />
              </div>
            </Section>

            {/* 文字種比率 */}
            <Section title="文字種比率">
              <div className="space-y-2">
                <RateBar label="ひらがな" rate={result.hiraganaRate} color="var(--accent)" />
                <RateBar label="カタカナ" rate={result.katakanaRate} color="var(--warning)" />
                <RateBar label="漢字" rate={result.kanjiRate} color="var(--success)" />
              </div>
            </Section>

            {/* 文体分析 */}
            <Section title="文体分析">
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="平均文長" value={`${result.avgSentenceLength.toFixed(1)} 字`} />
                <StatCard label="台詞率" value={`${(result.dialogueRate * 100).toFixed(1)}%`} />
              </div>
            </Section>

            {/* 文長推移グラフ（シンプルなバーチャート） */}
            {result.sentenceLengths.length > 0 && (
              <Section title="文長推移">
                <SentenceLengthChart lengths={result.sentenceLengths} />
              </Section>
            )}

            {/* 段落ごとの台詞比率推移 */}
            {result.dialogueRatios.length > 0 && (
              <Section title="段落別 台詞比率">
                <DialogueRatioChart ratios={result.dialogueRatios} />
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =========================================
// サブコンポーネント
// =========================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        className="text-sm font-medium mb-2"
        style={{ color: 'var(--text-mid)', fontFamily: 'var(--font-heading)' }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg p-3 text-center"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="text-lg font-medium" style={{ color: 'var(--text)' }}>{value}</div>
      <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}

function RateBar({ label, rate, color }: { label: string; rate: number; color: string }) {
  const pct = (rate * 100).toFixed(1);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-16 text-right" style={{ color: 'var(--text-mid)' }}>
        {label}
      </span>
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ height: '8px', background: 'var(--bg-deep)' }}
      >
        <div
          style={{
            width: `${Math.min(rate * 100, 100)}%`,
            height: '100%',
            background: color,
            borderRadius: '4px',
            transition: 'width 300ms ease-out',
          }}
        />
      </div>
      <span className="text-xs w-12" style={{ color: 'var(--text-muted)' }}>
        {pct}%
      </span>
    </div>
  );
}

/** 文長推移を簡易バーチャートで表示 */
function SentenceLengthChart({ lengths }: { lengths: number[] }) {
  const max = Math.max(...lengths, 1);
  // 表示する文数を最大100に制限
  const display = lengths.length > 100
    ? lengths.filter((_, i) => i % Math.ceil(lengths.length / 100) === 0)
    : lengths;

  return (
    <div
      className="flex items-end gap-px overflow-hidden rounded"
      style={{ height: '80px', background: 'var(--bg-deep)', padding: '4px' }}
    >
      {display.map((len, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${(len / max) * 100}%`,
            background: 'var(--accent)',
            borderRadius: '1px',
            minWidth: '2px',
            opacity: 0.8,
          }}
          title={`文${i + 1}: ${len}字`}
        />
      ))}
    </div>
  );
}

/** 段落別台詞比率をバーチャートで表示 */
function DialogueRatioChart({ ratios }: { ratios: number[] }) {
  // 表示数を最大80に制限
  const display = ratios.length > 80
    ? ratios.filter((_, i) => i % Math.ceil(ratios.length / 80) === 0)
    : ratios;

  return (
    <div
      className="flex items-end gap-px overflow-hidden rounded"
      style={{ height: '60px', background: 'var(--bg-deep)', padding: '4px' }}
    >
      {display.map((ratio, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${ratio * 100}%`,
            background: 'var(--warning)',
            borderRadius: '1px',
            minWidth: '2px',
            opacity: 0.8,
          }}
          title={`段落${i + 1}: ${(ratio * 100).toFixed(0)}%`}
        />
      ))}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useUIStore } from '@/shared/stores/uiStore';
import { useEditorStore } from '@/shared/stores/editorStore';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import type { AnalysisResult, StructureSection } from '@/shared/types';

type TabKey = 'basic' | 'vocabulary' | 'tempo' | 'structure' | 'style' | 'readability';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'basic', label: '基本' },
  { key: 'vocabulary', label: '語彙' },
  { key: 'tempo', label: 'テンポ' },
  { key: 'structure', label: '構造' },
  { key: 'style', label: '文体' },
  { key: 'readability', label: '読みやすさ' },
];

export function AnalysisModal() {
  const { analysisModalVisible, toggleAnalysisModal } = useUIStore();
  const currentEpisode = useEditorStore((s) => s.currentEpisode);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('basic');

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
        style={{ maxWidth: '760px', maxHeight: '85vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-base font-medium"
            style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}
          >
            文章分析
          </h2>
          <button className="btn btn-ghost text-xs" onClick={toggleAnalysisModal}>
            閉じる
          </button>
        </div>

        {/* タブヘッダー */}
        <div
          className="flex gap-1 mb-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-3 py-2 text-xs transition-colors"
              style={{
                color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-mid)',
                borderBottom:
                  activeTab === tab.key
                    ? '2px solid var(--accent)'
                    : '2px solid transparent',
                marginBottom: '-1px',
                fontFamily: 'var(--font-heading)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading && (
          <div
            className="text-sm text-center py-8"
            style={{ color: 'var(--text-muted)' }}
          >
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
            {activeTab === 'basic' && <BasicTab result={result} />}
            {activeTab === 'vocabulary' && <VocabularyTab result={result} />}
            {activeTab === 'tempo' && <TempoTab result={result} />}
            {activeTab === 'structure' && <StructureTab result={result} />}
            {activeTab === 'style' && <StyleTab result={result} />}
            {activeTab === 'readability' && <ReadabilityTab result={result} />}
          </div>
        )}
      </div>
    </div>
  );
}

// =========================================
// 基本タブ
// =========================================

function BasicTab({ result }: { result: AnalysisResult }) {
  return (
    <>
      <Section title="基本統計">
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="文字数" value={result.charCount.toLocaleString()} />
          <StatCard label="行数" value={result.lineCount.toLocaleString()} />
          <StatCard label="段落数" value={result.paragraphCount.toLocaleString()} />
          <StatCard label="文数" value={result.sentenceCount.toLocaleString()} />
        </div>
      </Section>

      <Section title="文字種比率">
        <div className="space-y-2">
          <RateBar label="ひらがな" rate={result.hiraganaRate} color="var(--accent)" />
          <RateBar label="カタカナ" rate={result.katakanaRate} color="var(--warning)" />
          <RateBar label="漢字" rate={result.kanjiRate} color="var(--success)" />
        </div>
      </Section>

      <Section title="基本指標">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="平均文長"
            value={`${result.avgSentenceLength.toFixed(1)} 字`}
          />
          <StatCard
            label="台詞率"
            value={`${(result.dialogueRate * 100).toFixed(1)}%`}
          />
        </div>
      </Section>

      {result.sentenceLengths.length > 0 && (
        <Section title="文長推移">
          <SentenceLengthChart lengths={result.sentenceLengths} />
        </Section>
      )}

      {result.dialogueRatios.length > 0 && (
        <Section title="段落別 台詞比率">
          <DialogueRatioChart ratios={result.dialogueRatios} />
        </Section>
      )}
    </>
  );
}

// =========================================
// 語彙タブ
// =========================================

function VocabularyTab({ result }: { result: AnalysisResult }) {
  return (
    <>
      <Section title="語彙サマリ">
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="総トークン数"
            value={result.totalTokenCount.toLocaleString()}
          />
          <StatCard
            label="ユニーク数"
            value={result.uniqueTokenCount.toLocaleString()}
          />
          <StatCard
            label="語彙多様性 (TTR)"
            value={result.vocabularyDiversity.toFixed(3)}
          />
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          ※ 簡易トークナイザ（2〜3文字n-gram）による参考値。TTRは1に近いほど語彙が豊富。
        </p>
      </Section>

      <Section title="頻出語ランキング（上位30）">
        {result.wordFrequencies.length === 0 ? (
          <EmptyHint text="頻度2以上の語が見つかりませんでした" />
        ) : (
          <div
            className="rounded-lg p-3"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="space-y-1">
              {result.wordFrequencies.map((wf, i) => (
                <FreqRow
                  key={`${wf.word}-${i}`}
                  rank={i + 1}
                  label={wf.word}
                  count={wf.count}
                  max={result.wordFrequencies[0].count}
                  color="var(--accent)"
                />
              ))}
            </div>
          </div>
        )}
      </Section>
    </>
  );
}

// =========================================
// テンポタブ
// =========================================

function TempoTab({ result }: { result: AnalysisResult }) {
  return (
    <>
      <Section title="リズム指標">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="文長 標準偏差"
            value={result.rhythmStddev.toFixed(1)}
          />
          <StatCard
            label="文長 分散"
            value={result.rhythmVariance.toFixed(1)}
          />
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          ※ 標準偏差が大きいほど文長のメリハリがあり、小さいほど均一な文章。
        </p>
      </Section>

      <Section title="場面転換">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="転換回数"
            value={result.sceneBreakCount.toLocaleString()}
          />
          <StatCard
            label="密度（/段落）"
            value={result.sceneBreakDensity.toFixed(3)}
          />
        </div>
      </Section>

      {result.dialogueNarrativePattern.length > 0 && (
        <Section title="段落別 台詞/地の文パターン">
          <DialoguePatternChart pattern={result.dialogueNarrativePattern} />
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            ※ 青＝地の文主体、橙＝台詞主体。偏りが続くとテンポが単調になりがち。
          </p>
        </Section>
      )}
    </>
  );
}

// =========================================
// 構造タブ
// =========================================

function StructureTab({ result }: { result: AnalysisResult }) {
  return (
    <>
      <Section title="起承転結 推定">
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          ※ 文字数で機械的に4等分した参考指標です。精度は保証されません。
        </p>
        <div className="space-y-2">
          {result.estimatedStructure.map((sec) => (
            <StructureRow key={sec.label} section={sec} />
          ))}
        </div>
      </Section>

      <Section title="盛り上がり曲線（推定クライマックス）">
        <IntensityChart
          curve={result.intensityCurve}
          climaxPos={result.climaxPosition}
        />
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          ※ 台詞率・感嘆符密度・文長ばらつきから算出した参考指標。
          推定クライマックス位置：
          <strong style={{ color: 'var(--accent)' }}>
            {' '}
            {(result.climaxPosition * 100).toFixed(0)}%
          </strong>
        </p>
      </Section>
    </>
  );
}

// =========================================
// 文体タブ
// =========================================

function StyleTab({ result }: { result: AnalysisResult }) {
  return (
    <>
      <Section title="敬体/常体">
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="敬体の文数"
            value={result.politeFormCount.toLocaleString()}
          />
          <StatCard
            label="常体の文数"
            value={result.plainFormCount.toLocaleString()}
          />
          <StatCard
            label="敬体率"
            value={`${(result.politeFormRatio * 100).toFixed(1)}%`}
          />
        </div>
        <div className="mt-3">
          <RateBar
            label="敬体比率"
            rate={result.politeFormRatio}
            color="var(--accent)"
          />
        </div>
      </Section>

      <Section title="敬体/常体 混在警告">
        {result.mixedStyleWarnings.length === 0 ? (
          <EmptyHint text="混在箇所は検出されませんでした" />
        ) : (
          <div
            className="rounded-lg p-3 text-xs"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          >
            <p className="mb-2" style={{ color: 'var(--warning)' }}>
              {result.mixedStyleWarnings.length} 箇所で敬体と常体の混在を検出
            </p>
            <p style={{ color: 'var(--text-muted)' }}>
              文番号:{' '}
              {result.mixedStyleWarnings
                .slice(0, 20)
                .map((i) => `#${i + 1}`)
                .join(', ')}
              {result.mixedStyleWarnings.length > 20 && ' ...'}
            </p>
          </div>
        )}
      </Section>
    </>
  );
}

// =========================================
// 読みやすさタブ
// =========================================

function ReadabilityTab({ result }: { result: AnalysisResult }) {
  const minutes = Math.floor(result.estimatedReadingMinutes);
  const seconds = Math.round(
    (result.estimatedReadingMinutes - minutes) * 60,
  );
  const readingTime = minutes > 0 ? `約 ${minutes}分${seconds}秒` : `約 ${seconds}秒`;

  return (
    <>
      <Section title="推定読了時間">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="読了時間" value={readingTime} />
          <StatCard
            label="ユニーク漢字数"
            value={result.uniqueKanjiCount.toLocaleString()}
          />
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          ※ 小説の平均読書速度 500文字/分 で試算。
        </p>
      </Section>

      <Section title="検出された難読漢字">
        {result.difficultKanji.length === 0 ? (
          <EmptyHint text="難読漢字は検出されませんでした" />
        ) : (
          <div
            className="rounded-lg p-3"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="flex flex-wrap gap-2">
              {result.difficultKanji.map((kf, i) => (
                <div
                  key={`${kf.kanji}-${i}`}
                  className="flex items-center gap-1 px-2 py-1 rounded"
                  style={{
                    background: 'var(--bg-deep)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <span
                    className="text-base"
                    style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}
                  >
                    {kf.kanji}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    ×{kf.count}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
              ※ 文学作品に頻出する難読漢字リストとの照合結果です。
            </p>
          </div>
        )}
      </Section>
    </>
  );
}

// =========================================
// 共通サブコンポーネント
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
      <div className="text-lg font-medium" style={{ color: 'var(--text)' }}>
        {value}
      </div>
      <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
    </div>
  );
}

function RateBar({
  label,
  rate,
  color,
}: {
  label: string;
  rate: number;
  color: string;
}) {
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

function FreqRow({
  rank,
  label,
  count,
  max,
  color,
}: {
  rank: number;
  label: string;
  count: number;
  max: number;
  color: string;
}) {
  const pct = (count / max) * 100;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className="w-6 text-right"
        style={{ color: 'var(--text-muted)' }}
      >
        {rank}
      </span>
      <span
        className="w-20"
        style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}
      >
        {label}
      </span>
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ height: '6px', background: 'var(--bg-deep)' }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            borderRadius: '3px',
          }}
        />
      </div>
      <span
        className="w-10 text-right"
        style={{ color: 'var(--text-muted)' }}
      >
        {count}
      </span>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div
      className="rounded-lg p-4 text-xs text-center"
      style={{
        background: 'var(--bg-surface)',
        border: '1px dashed var(--border)',
        color: 'var(--text-muted)',
      }}
    >
      {text}
    </div>
  );
}

function StructureRow({ section }: { section: StructureSection }) {
  return (
    <div
      className="rounded-lg p-3"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-3">
        <span
          className="text-lg font-medium w-8 text-center"
          style={{ color: 'var(--accent)', fontFamily: 'var(--font-heading)' }}
        >
          {section.label}
        </span>
        <div className="flex-1 grid grid-cols-3 gap-2 text-xs">
          <div>
            <span style={{ color: 'var(--text-muted)' }}>文字数比: </span>
            <span style={{ color: 'var(--text)' }}>
              {(section.charRatio * 100).toFixed(1)}%
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>台詞率: </span>
            <span style={{ color: 'var(--text)' }}>
              {(section.dialogueRate * 100).toFixed(1)}%
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>平均文長: </span>
            <span style={{ color: 'var(--text)' }}>
              {section.avgSentenceLength.toFixed(1)}字
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================
// チャート
// =========================================

function SentenceLengthChart({ lengths }: { lengths: number[] }) {
  const max = Math.max(...lengths, 1);
  const display =
    lengths.length > 100
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

function DialogueRatioChart({ ratios }: { ratios: number[] }) {
  const display =
    ratios.length > 80
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

function DialoguePatternChart({ pattern }: { pattern: boolean[] }) {
  const display =
    pattern.length > 120
      ? pattern.filter((_, i) => i % Math.ceil(pattern.length / 120) === 0)
      : pattern;

  return (
    <div
      className="flex gap-px overflow-hidden rounded"
      style={{ height: '40px', background: 'var(--bg-deep)', padding: '4px' }}
    >
      {display.map((isDialogue, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: '100%',
            background: isDialogue ? 'var(--warning)' : 'var(--accent)',
            borderRadius: '1px',
            minWidth: '2px',
            opacity: 0.7,
          }}
          title={`段落${i + 1}: ${isDialogue ? '台詞主体' : '地の文主体'}`}
        />
      ))}
    </div>
  );
}

function IntensityChart({
  curve,
  climaxPos,
}: {
  curve: number[];
  climaxPos: number;
}) {
  const max = Math.max(...curve, 0.01);
  const climaxIdx = Math.floor(climaxPos * curve.length);

  return (
    <div
      className="flex items-end gap-1 overflow-hidden rounded"
      style={{ height: '100px', background: 'var(--bg-deep)', padding: '6px' }}
    >
      {curve.map((score, i) => (
        <div
          key={i}
          className="flex-1 flex flex-col items-center justify-end"
          style={{ height: '100%' }}
        >
          <div
            style={{
              width: '100%',
              height: `${(score / max) * 100}%`,
              background:
                i === climaxIdx ? 'var(--danger)' : 'var(--accent)',
              borderRadius: '2px',
              minHeight: '2px',
              opacity: i === climaxIdx ? 1 : 0.7,
              transition: 'height 300ms ease-out',
            }}
            title={`区間${i + 1}: ${score.toFixed(3)}`}
          />
          <span
            className="text-xs mt-1"
            style={{ color: 'var(--text-muted)', fontSize: '10px' }}
          >
            {i + 1}
          </span>
        </div>
      ))}
    </div>
  );
}

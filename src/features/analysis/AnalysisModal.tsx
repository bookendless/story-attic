import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useUIStore } from '@/shared/stores/uiStore';
import { useEditorStore } from '@/shared/stores/editorStore';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import type { AnalysisResult, StructureSection } from '@/shared/types';

type TabKey = 'structure' | 'tempo' | 'vocabulary' | 'character' | 'emotion' | 'narrative' | 'writing';
type AnalysisScope = 'episode' | 'project';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'structure',  label: '構造' },
  { key: 'tempo',      label: 'テンポ' },
  { key: 'vocabulary', label: '語彙' },
  { key: 'character',  label: '人物' },
  { key: 'emotion',    label: '感情' },
  { key: 'narrative',  label: '物語' },
  { key: 'writing',    label: '文章' },
];

export function AnalysisModal() {
  const { analysisModalVisible, toggleAnalysisModal } = useUIStore();
  const currentEpisode = useEditorStore((s) => s.currentEpisode);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('structure');
  const [scope, setScope] = useState<AnalysisScope>('episode');
  const [characterCount, setCharacterCount] = useState<number>(0);

  const handleAnalyze = useCallback(() => {
    if (!currentEpisode) return;
    setLoading(true);
    setError(null);
    const getTextPromise: Promise<string> =
      scope === 'project'
        ? invoke<string>('get_project_full_text', { projectId: currentEpisode.projectId })
        : Promise.resolve(currentEpisode.body);
    getTextPromise
      .then((text) => invoke<unknown>('analyze_text', { text }))
      .then((raw) => setResult(toCamelCase<AnalysisResult>(raw)))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [currentEpisode, scope]);

  useEffect(() => {
    if (!analysisModalVisible) return;
    handleAnalyze();
    if (currentEpisode?.projectId) {
      invoke<unknown[]>('get_characters', { projectId: currentEpisode.projectId })
        .then((chars) => setCharacterCount(chars.length))
        .catch(() => setCharacterCount(0));
    }
  }, [analysisModalVisible, currentEpisode, handleAnalyze]);

  if (!analysisModalVisible) return null;

  return (
    <div className="modal-overlay" onClick={toggleAnalysisModal}>
      <div
        className="modal-box"
        style={{ maxWidth: '760px', height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-base font-medium"
            style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}
          >
            テキスト分析
          </h2>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-ghost text-xs"
              onClick={handleAnalyze}
              disabled={loading}
            >
              再分析
            </button>
            <button className="btn btn-ghost text-xs" onClick={toggleAnalysisModal}>
              ✕
            </button>
          </div>
        </div>

        {/* スコープ切替 */}
        <div className="flex gap-2 mb-3">
          {(['episode', 'project'] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setScope(s); setResult(null); }}
              className="px-3 py-1 text-xs rounded-full transition-colors"
              style={{
                background: scope === s ? 'var(--accent)' : 'var(--bg-surface)',
                color: scope === s ? 'var(--bg)' : 'var(--text-mid)',
                border: `1px solid ${scope === s ? 'var(--accent)' : 'var(--border)'}`,
                fontFamily: 'var(--font-heading)',
              }}
            >
              {s === 'episode' ? '現在の話' : '作品全体'}
            </button>
          ))}
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

        {/* コンテンツエリア（ここだけスクロール） */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
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
              {activeTab === 'structure'  && <StructureTab result={result} />}
              {activeTab === 'tempo'      && <TempoTab result={result} />}
              {activeTab === 'vocabulary' && <VocabularyTab result={result} />}
              {activeTab === 'character'  && <CharacterTab result={result} characterCount={characterCount} />}
              {activeTab === 'emotion'    && <EmotionTab result={result} />}
              {activeTab === 'narrative'  && <NarrativeTab result={result} />}
              {activeTab === 'writing'    && <WritingTab result={result} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =========================================
// 構造タブ
// =========================================

function StructureTab({ result }: { result: AnalysisResult }) {
  return (
    <>
      <Section title="基本統計">
        <div className="grid grid-cols-4 gap-3">
          <StatCard
            label="総文字数（空白除く）"
            value={result.charCount.toLocaleString()}
            unit="文字"
          />
          <StatCard
            label="総段落数"
            value={result.paragraphCount.toLocaleString()}
            unit="段落"
          />
          <StatCard
            label="総文数"
            value={result.sentenceCount.toLocaleString()}
            unit="文"
          />
          <StatCard
            label="平均段落長"
            value={result.avgParagraphLength.toFixed(1)}
            unit="文字/段落"
            hint="短いほど読みやすい"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <StatCard
            label="平均文長"
            value={result.avgSentenceLength.toFixed(1)}
            unit="文字/文"
          />
          <StatCard
            label="最長文"
            value={result.maxSentenceLength.toLocaleString()}
            unit="文字"
          />
        </div>
      </Section>

      {result.paragraphLengths.length > 0 && (
        <Section title="段落長の推移">
          <SentenceLengthChart lengths={result.paragraphLengths} label="段落" />
        </Section>
      )}

      {result.paragraphLengths.length > 0 && (
        <Section title="段落長の分布">
          <ParagraphLengthHistogram lengths={result.paragraphLengths} />
        </Section>
      )}

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
// テンポタブ
// =========================================

function TempoTab({ result }: { result: AnalysisResult }) {
  const maxVal = Math.max(
    result.verbDensity,
    result.dialogueRate,
    result.adjDensity,
    result.psychoDensity,
    0.01,
  );

  return (
    <>
      <Section title="テンポ指標">
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="イベント密度"
            value={result.verbDensity.toFixed(2)}
            unit="動詞/文"
            hint="高いほど展開が速い"
          />
          <StatCard
            label="会話率"
            value={`${(result.dialogueRate * 100).toFixed(1)}%`}
            unit="テンポ感に直結"
          />
          <StatCard
            label="平均文長"
            value={result.avgSentenceLength.toFixed(1)}
            unit="文字/文"
          />
          <StatCard
            label="描写密度（形容詞）"
            value={result.adjDensity.toFixed(2)}
            unit="個/文"
            hint="情景の濃さ"
          />
          <StatCard
            label="心理描写密度"
            value={result.psychoDensity.toFixed(2)}
            unit="個/文"
            hint="内面中心度"
          />
          <StatCard
            label="段落転換率"
            value={result.paragraphDensity.toFixed(2)}
            unit="段落/千字"
            hint="高いほど展開が小刻み"
          />
        </div>
      </Section>

      <Section title="テンポ構成">
        <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>各要素の比率</p>
        <div className="space-y-2">
          <RateBar label="イベント密度" rate={result.verbDensity / maxVal} color="var(--accent)" valueLabel={result.verbDensity.toFixed(2)} />
          <RateBar label="会話率" rate={result.dialogueRate} color="var(--warning)" valueLabel={`${(result.dialogueRate * 100).toFixed(0)}%`} />
          <RateBar label="描写密度（形容詞）" rate={result.adjDensity / maxVal} color="#7cb8a0" valueLabel={result.adjDensity.toFixed(2)} />
          <RateBar label="心理描写密度" rate={result.psychoDensity / maxVal} color="#a07cb8" valueLabel={result.psychoDensity.toFixed(2)} />
        </div>
      </Section>

      {result.sentenceLengths.length > 0 && (
        <Section title="文長の推移">
          <SentenceLengthChart lengths={result.sentenceLengths} label="文" />
        </Section>
      )}

      {result.dialogueNarrativePattern.length > 0 && (
        <Section title="段落別 台詞/地の文パターン">
          <DialoguePatternChart pattern={result.dialogueNarrativePattern} />
          <p className="text-xs mt-2 flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1">
              <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '2px', background: '#6b9fc4', opacity: 0.85 }} />
              地の文主体
            </span>
            <span className="flex items-center gap-1">
              <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '2px', background: '#d4834a', opacity: 0.85 }} />
              台詞主体
            </span>
            <span>偏りが続くとテンポが単調になりがち。</span>
          </p>
        </Section>
      )}
    </>
  );
}

// =========================================
// 語彙タブ
// =========================================

function VocabularyTab({ result }: { result: AnalysisResult }) {
  const posMax = Math.max(result.verbCount, result.adjCount, result.psychoWordCount, result.metaphorCount, 1);

  return (
    <>
      <Section title="語彙指標">
        <div className="grid grid-cols-4 gap-3">
          <StatCard
            label="語彙多様度(TTR)"
            value={`${(result.vocabularyDiversity * 100).toFixed(1)}%`}
            unit="異なり文字/総文字"
            hint="高いほど文章が豊か"
          />
          <StatCard
            label="難語率"
            value={`${(result.difficultWordRate * 100).toFixed(1)}%`}
            unit="スコア"
            hint="高いほど読者レベルが高い"
          />
          <StatCard
            label="比喩率"
            value={`${(result.metaphorRate * 100).toFixed(1)}%`}
            unit="16表現"
            hint="文学性"
          />
          <StatCard
            label="カタカナ語数"
            value={result.katakanaWordCount.toLocaleString()}
            unit="語"
            hint="世界観・SF度"
          />
        </div>
      </Section>

      <Section title="頻出文字 Top 10">
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
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>出現回数ランキング</p>
            <div className="space-y-1">
              {result.wordFrequencies.slice(0, 10).map((wf, i) => (
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

      <Section title="品詞構成（概算）">
        <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>動詞・形容詞・心理語・比喩表現の比率</p>
        <div className="space-y-2">
          <RateBar label="動詞" rate={result.verbCount / posMax} color="var(--accent)" valueLabel={`${result.verbCount}回`} />
          <RateBar label="形容詞" rate={result.adjCount / posMax} color="var(--warning)" valueLabel={`${result.adjCount}回`} />
          <RateBar label="心理語" rate={result.psychoWordCount / posMax} color="#a07cb8" valueLabel={`${result.psychoWordCount}回`} />
          <RateBar label="比喩表現" rate={result.metaphorCount / posMax} color="#c87070" valueLabel={`${result.metaphorCount}回`} />
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          ※ 形態素解析なしの概算値。実際の品詞とは異なる場合があります。
        </p>
      </Section>

      <SensoryBalanceSection result={result} />
    </>
  );
}

// =========================================
// 人物＆視点タブ
// =========================================

function CharacterTab({
  result,
  characterCount,
}: {
  result: AnalysisResult;
  characterCount: number;
}) {
  const fpRate = result.charCount > 0
    ? (result.firstPersonCount / (result.charCount / 1000)).toFixed(2)
    : '0.00';

  return (
    <>
      <Section title="人物・視点の概要">
        <div className="grid grid-cols-4 gap-3">
          <StatCard
            label="登録人物数"
            value={characterCount.toLocaleString()}
            unit="人"
            hint="登録済み人物"
          />
          <StatCard
            label="一人称出現数"
            value={result.firstPersonCount.toLocaleString()}
            unit="回"
            hint={`${fpRate}回/千字`}
          />
          <StatCard
            label="視点切替数"
            value={result.povSwitchCount.toLocaleString()}
            unit="回"
            hint="群像劇度"
          />
          <StatCard
            label="一人称率"
            value={`${fpRate}回/千字`}
            unit="語り手形式"
          />
        </div>
      </Section>

      <Section title="語り手分析">
        <div
          className="rounded-lg p-4"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <span
              className="text-sm font-medium px-3 py-1 rounded-full"
              style={{
                background: 'var(--accent)',
                color: 'var(--bg)',
                fontFamily: 'var(--font-heading)',
              }}
            >
              {result.narratorType || '不明'}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              視点
            </span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
            {result.narratorAnalysis || '分析に必要なデータが不足しています。'}
          </p>
        </div>
        {characterCount === 0 && (
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            人物タブで人物を登録すると出現数を集計します。
          </p>
        )}
      </Section>
    </>
  );
}

// =========================================
// 感情タブ
// =========================================

function EmotionTab({ result }: { result: AnalysisResult }) {
  const total = result.positiveWordCount + result.negativeWordCount;
  const posPct = total > 0 ? result.positiveWordCount / total : 0;
  const negPct = total > 0 ? result.negativeWordCount / total : 0;
  const maxEmo = Math.max(result.positiveWordCount, result.negativeWordCount, result.tensionWordCount, 1);

  return (
    <>
      <Section title="感情語の概要">
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="ポジティブ語"
            value={result.positiveWordCount.toLocaleString()}
            unit="語"
            hint={`ポジネガ比:${(posPct * 100).toFixed(1)}%`}
          />
          <StatCard
            label="ネガティブ語"
            value={result.negativeWordCount.toLocaleString()}
            unit="語"
            hint={`${(negPct * 100).toFixed(1)}%`}
          />
          <StatCard
            label="緊張度（危機語）"
            value={result.tensionWordCount.toLocaleString()}
            unit="語"
            hint="ドラマ性"
          />
        </div>
      </Section>

      <Section title="感情バランス">
        <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>ポジ・ネガ語の比率</p>
        <div className="space-y-2">
          <RateBar label="ポジティブ" rate={result.positiveWordCount / maxEmo} color="#5a9e6e" valueLabel={`${result.positiveWordCount}語`} />
          <RateBar label="ネガティブ" rate={result.negativeWordCount / maxEmo} color="#c87070" valueLabel={`${result.negativeWordCount}語`} />
          <RateBar label="緊張（危機）" rate={result.tensionWordCount / maxEmo} color="#c8a070" valueLabel={`${result.tensionWordCount}語`} />
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          ※ ポジ語とネガ語の簡易辞書による概算です。
        </p>
      </Section>

      {result.emotionCurve.length > 0 && (
        <Section title="感情曲線（推移）">
          <EmotionCurveChart curve={result.emotionCurve} />
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            ※ 上方向がポジティブ寄り。ポジ語とネガ語の簡易辞書による概算です。
          </p>
        </Section>
      )}
    </>
  );
}

// =========================================
// 物語タブ
// =========================================

function NarrativeTab({ result }: { result: AnalysisResult }) {
  const maxVal = Math.max(
    result.questionSentenceCount,
    result.metaphorCount,
    result.tensionWordCount,
    result.psychoWordCount,
    1,
  );

  return (
    <>
      <Section title="物語要素の概要">
        <div className="grid grid-cols-4 gap-3">
          <StatCard
            label="疑問文（謎提示）"
            value={result.questionSentenceCount.toLocaleString()}
            unit="文"
            hint="ミステリー度"
          />
          <StatCard
            label="比喩表現"
            value={result.metaphorCount.toLocaleString()}
            unit="表現"
            hint={`${(result.metaphorRate * 100).toFixed(1)}% 文学性`}
          />
          <StatCard
            label="緊張語（危機）"
            value={result.tensionWordCount.toLocaleString()}
            unit="語"
            hint="ドラマ性"
          />
          <StatCard
            label="心理語"
            value={result.psychoWordCount.toLocaleString()}
            unit="語"
            hint={`${result.psychoDensity.toFixed(2)}個/文`}
          />
        </div>
      </Section>

      <Section title="物語要素スコア">
        <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>物語要素の強さ</p>
        <div className="space-y-2">
          <RateBar label="謎・疑問（ミステリー度）" rate={result.questionSentenceCount / maxVal} color="var(--accent)" valueLabel={`${result.questionSentenceCount}`} />
          <RateBar label="比喩（文学性）" rate={result.metaphorCount / maxVal} color="var(--warning)" valueLabel={`${result.metaphorCount}`} />
          <RateBar label="緊張・危機（ドラマ性）" rate={result.tensionWordCount / maxVal} color="#c87070" valueLabel={`${result.tensionWordCount}`} />
          <RateBar label="心理描写（内面度）" rate={result.psychoWordCount / maxVal} color="#a07cb8" valueLabel={`${result.psychoWordCount}`} />
        </div>
      </Section>
    </>
  );
}

// =========================================
// 文章タブ
// =========================================

function WritingTab({ result }: { result: AnalysisResult }) {
  const minutes = Math.floor(result.estimatedReadingMinutes);
  const seconds = Math.round((result.estimatedReadingMinutes - minutes) * 60);
  const readingTime = minutes > 0 ? `約 ${minutes}分${seconds}秒` : `約 ${seconds}秒`;

  return (
    <>
      <Section title="文章の特徴">
        <div className="grid grid-cols-4 gap-3">
          <StatCard
            label="読解指数"
            value={result.readabilityScore.toFixed(0)}
            unit="スコア/100"
            hint="高いほど難解"
          />
          <StatCard
            label="文章リズム"
            value={result.writingRhythm.toFixed(1)}
            unit="字/句点間"
            hint="文章テンポ"
          />
          <StatCard
            label="段落転換率"
            value={result.paragraphDensity.toFixed(2)}
            unit="段落/千字"
            hint="テンポ"
          />
          <StatCard
            label="語彙多様度"
            value={`${(result.vocabularyDiversity * 100).toFixed(1)}%`}
            unit="TTR"
            hint="文体の豊かさ"
          />
        </div>
      </Section>

      <Section title="文体プロファイル">
        <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>文の特徴スコア</p>
        <div className="space-y-2">
          <RateBar label="読解指数" rate={result.readabilityScore / 100} color="var(--accent)" valueLabel={result.readabilityScore.toFixed(0)} />
          <RateBar label="語彙多様度" rate={result.vocabularyDiversity} color="var(--warning)" valueLabel={`${(result.vocabularyDiversity * 100).toFixed(0)}%`} />
          <RateBar label="会話率" rate={result.dialogueRate} color="#7cb8a0" valueLabel={`${(result.dialogueRate * 100).toFixed(0)}%`} />
          <RateBar label="心理描写密度" rate={Math.min(result.psychoDensity, 1)} color="#a07cb8" valueLabel={(result.psychoDensity * 100).toFixed(0)} />
        </div>
      </Section>

      {result.paragraphLengths.length > 0 && (
        <Section title="文章の長さリズム">
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>段落長の推移</p>
          <SentenceLengthChart lengths={result.paragraphLengths} label="段落" />
        </Section>
      )}

      <Section title="推定読了時間">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="読了時間" value={readingTime} unit="" />
          <StatCard
            label="ユニーク漢字数"
            value={result.uniqueKanjiCount.toLocaleString()}
            unit="字"
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
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
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
// 感覚語バランス
// =========================================

function SensoryBalanceSection({ result }: { result: AnalysisResult }) {
  const total =
    result.sensoryVisualCount +
    result.sensoryAuditoryCount +
    result.sensoryTactileCount +
    result.sensoryOlfactoryCount +
    result.sensoryGustatoryCount;

  if (total === 0) {
    return (
      <Section title="感覚語バランス">
        <EmptyHint text="感覚語が検出されませんでした" />
      </Section>
    );
  }

  const maxCount = Math.max(
    result.sensoryVisualCount,
    result.sensoryAuditoryCount,
    result.sensoryTactileCount,
    result.sensoryOlfactoryCount,
    result.sensoryGustatoryCount,
    1,
  );

  const senses = [
    { label: '視覚', count: result.sensoryVisualCount, color: '#6b9fc4' },
    { label: '聴覚', count: result.sensoryAuditoryCount, color: '#7cb8a0' },
    { label: '触覚', count: result.sensoryTactileCount, color: '#c8a070' },
    { label: '嗅覚', count: result.sensoryOlfactoryCount, color: '#a07cb8' },
    { label: '味覚', count: result.sensoryGustatoryCount, color: '#c87070' },
  ];

  return (
    <Section title="感覚語バランス（五感）">
      <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
        視覚・聴覚・触覚・嗅覚・味覚の語彙分布（計{total}語）
      </p>
      <div className="space-y-2">
        {senses.map(({ label, count, color }) => (
          <RateBar
            key={label}
            label={label}
            rate={count / maxCount}
            color={color}
            valueLabel={`${count}語`}
          />
        ))}
      </div>
      <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
        ※ 視覚偏重が多い場合、聴覚・触覚・嗅覚の描写を加えると没入感が増します。
      </p>
    </Section>
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

function StatCard({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
}) {
  return (
    <div
      className="rounded-lg p-3"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="text-lg font-medium" style={{ color: 'var(--text)' }}>
        {value}
      </div>
      {unit && (
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {unit}
        </div>
      )}
      <div className="text-xs mt-1" style={{ color: 'var(--text-mid)', fontFamily: 'var(--font-heading)' }}>
        {label}
      </div>
      {hint && (
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function RateBar({
  label,
  rate,
  color,
  valueLabel,
}: {
  label: string;
  rate: number;
  color: string;
  valueLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-28 text-right shrink-0" style={{ color: 'var(--text-mid)' }}>
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
      <span className="text-xs w-14 text-right shrink-0" style={{ color: 'var(--text-muted)' }}>
        {valueLabel ?? `${(rate * 100).toFixed(1)}%`}
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
      <span className="w-6 text-right" style={{ color: 'var(--text-muted)' }}>
        {rank}
      </span>
      <span className="w-20" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
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
      <span className="w-12 text-right" style={{ color: 'var(--text-muted)' }}>
        {count}回
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

function SentenceLengthChart({ lengths, label }: { lengths: number[]; label: string }) {
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
          title={`${label}${i + 1}: ${len}字`}
        />
      ))}
    </div>
  );
}

function ParagraphLengthHistogram({ lengths }: { lengths: number[] }) {
  const buckets = [
    { label: '〜20字',   max: 20 },
    { label: '21〜50字', max: 50 },
    { label: '51〜100字', max: 100 },
    { label: '101〜200字', max: 200 },
    { label: '200字超',  max: Infinity },
  ];

  const counts = buckets.map(({ max: bMax }, idx) => {
    const min = idx === 0 ? 0 : buckets[idx - 1].max + 1;
    return lengths.filter((l) => l >= min && l <= bMax).length;
  });

  const maxCount = Math.max(...counts, 1);

  return (
    <div
      className="rounded-lg p-3"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>段落長ヒストグラム（段落数）</p>
      <div className="space-y-2">
        {buckets.map((bucket, i) => (
          <div key={bucket.label} className="flex items-center gap-3">
            <span className="text-xs w-24 text-right shrink-0" style={{ color: 'var(--text-mid)' }}>
              {bucket.label}
            </span>
            <div
              className="flex-1 rounded-full overflow-hidden"
              style={{ height: '10px', background: 'var(--bg-deep)' }}
            >
              <div
                style={{
                  width: `${(counts[i] / maxCount) * 100}%`,
                  height: '100%',
                  background: 'var(--accent)',
                  borderRadius: '4px',
                  transition: 'width 300ms ease-out',
                  opacity: 0.85,
                }}
              />
            </div>
            <span className="text-xs w-14 text-right shrink-0" style={{ color: 'var(--text-muted)' }}>
              {counts[i]}段落
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DialoguePatternChart({ pattern }: { pattern: boolean[] }) {
  const display =
    pattern.length > 120
      ? pattern.filter((_, i) => i % Math.ceil(pattern.length / 120) === 0)
      : pattern;

  const NARRATIVE_COLOR = '#6b9fc4';
  const DIALOGUE_COLOR = '#d4834a';

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
            background: isDialogue ? DIALOGUE_COLOR : NARRATIVE_COLOR,
            borderRadius: '1px',
            minWidth: '2px',
            opacity: 0.85,
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
              background: i === climaxIdx ? 'var(--danger)' : 'var(--accent)',
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

function EmotionCurveChart({ curve }: { curve: number[] }) {
  // curve: -1.0〜+1.0 の配列（10要素）
  // 上半分がポジティブ、下半分がネガティブ
  return (
    <div
      className="rounded overflow-hidden"
      style={{ height: '80px', background: 'var(--bg-deep)', padding: '4px', position: 'relative' }}
    >
      {/* 中心線 */}
      <div
        style={{
          position: 'absolute',
          left: 4,
          right: 4,
          top: '50%',
          height: '1px',
          background: 'var(--border)',
          zIndex: 1,
        }}
      />
      <div className="flex items-center h-full gap-1" style={{ position: 'relative', zIndex: 2 }}>
        {curve.map((score, i) => {
          const isPos = score >= 0;
          const pct = Math.abs(score) * 46; // 最大46px (高さ80の半分-余白)
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-center h-full"
            >
              {isPos ? (
                <>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                    <div
                      style={{
                        width: '100%',
                        height: `${pct}px`,
                        background: '#5a9e6e',
                        borderRadius: '2px 2px 0 0',
                        opacity: 0.85,
                        minWidth: '4px',
                      }}
                      title={`ブロック${i + 1}: +${score.toFixed(2)}`}
                    />
                  </div>
                  <div style={{ flex: 1 }} />
                </>
              ) : (
                <>
                  <div style={{ flex: 1 }} />
                  <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: '100%',
                        height: `${pct}px`,
                        background: '#c87070',
                        borderRadius: '0 0 2px 2px',
                        opacity: 0.85,
                        minWidth: '4px',
                      }}
                      title={`ブロック${i + 1}: ${score.toFixed(2)}`}
                    />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

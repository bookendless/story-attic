/**
 * AI 思考パートナー マニュアルモーダル
 * Catalyst（AIアシスタント）の役割・各機能の使い方を解説する。
 */

import { useUIStore } from '@/shared/stores/uiStore';
import { PHASE_COLORS } from './phaseColors';

export function AiManualModal() {
  const { aiManualVisible, toggleAiManual } = useUIStore();
  if (!aiManualVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(3px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) toggleAiManual(); }}
    >
      <div
        style={{
          width: 'min(680px, 92vw)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-deep)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        {/* ヘッダー */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--text)',
                fontFamily: 'var(--font-heading)',
                letterSpacing: '0.04em',
              }}
            >
              AI 思考パートナー — Catalyst マニュアル
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              創作の主体はあなた。Catalyst は問いで思考を深めます。
            </div>
          </div>
          <button
            onClick={toggleAiManual}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '4px 8px',
              borderRadius: '6px',
            }}
            title="閉じる"
          >
            ✕
          </button>
        </div>

        {/* スクロールコンテンツ */}
        <div
          style={{
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* 基本原則 */}
          <Section title="基本原則" icon="◎">
            <PrincipleCard
              title="30% AI / 70% Human"
              desc="Catalyst はあなたの代わりに書きません。答えではなく「問い」を返すことで、あなた自身の思考を引き出します。"
            />
            <PrincipleCard
              title="代筆なし"
              desc="完成した文章や続き文の提示は行いません。創作の主体権はつねにあなたにあります。"
            />
            <PrincipleCard
              title="執筆中は沈黙"
              desc="執筆フェーズではAIは「静かに見守り中」モードになります。あなたが呼びかけたときだけ応答します。"
            />
          </Section>

          {/* 創作フェーズ */}
          <Section title="創作フェーズ" icon="⬡">
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: '1.7' }}>
              現在の創作ステージをAIに伝えます。フェーズに応じてAIの支援スタイルとコンテキスト参照が自動で切り替わります。
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <PhaseCard phase="explore" label="探索" icon="◎"
                desc="アイデアを自由に広げる段階。AIは「もし〜なら？」で可能性を広げます。" />
              <PhaseCard phase="structure" label="構造" icon="⬡"
                desc="構成・プロット・伏線を固める段階。AIは矛盾・論理的整合性を問います。" />
              <PhaseCard phase="write" label="執筆" icon="✦"
                desc="書くことに集中する段階。AIは沈黙を守り、呼ばれたときだけ応答します。" />
              <PhaseCard phase="revise" label="改稿" icon="↺"
                desc="推敲・改善する段階。AIはテーマ適合度・文体一貫性を問います。" />
            </div>
          </Section>

          {/* 作家タイプ */}
          <Section title="作家タイプ" icon="✦">
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: '1.7' }}>
              あなたの思考スタイルをAIに伝えます。プロジェクト単位で保存されます。
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <TypeCard
                label="Explorer（発散型）"
                desc="可能性を広げたい人向け。「もし〜なら？」「逆説的な展開は？」など、発想を広げる問いを優先します。"
              />
              <TypeCard
                label="Architect（構造型）"
                desc="整合性を固めたい人向け。矛盾・因果関係・伏線の回収など、論理的な問いを優先します。"
              />
            </div>
          </Section>

          {/* 口調 */}
          <Section title="口調" icon="↺">
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { label: '丁寧', desc: '礼儀正しく丁寧な応答。デフォルト設定。' },
                { label: 'カジュアル', desc: 'フランクで親しみやすい応答。' },
                { label: '辛口', desc: '遠慮なく率直な指摘。「問い」の原則は守ります。' },
              ].map((t) => (
                <div
                  key={t.label}
                  style={{
                    flex: '1 1 140px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
                    {t.label}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.6' }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* コンテキスト参照 */}
          <Section title="コンテキスト参照" icon="◎">
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: '1.7' }}>
              AIに送る参照情報を選択します。フェーズ変更時に自動でデフォルト設定に切り替わります。
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {[
                { label: '本文', desc: '現在のエピソード本文（最大1,200字）' },
                { label: '人物', desc: 'キャラクタープロフィール（最大3,000字）' },
                { label: '用語', desc: '用語集（最大2,000字）' },
                { label: 'プロット', desc: 'プロット構造（最大2,000字）' },
                { label: '世界観', desc: '世界観設定マテリアル（最大1,000字）' },
                { label: 'あらすじ', desc: '作品のあらすじ（最大3,000字）' },
                { label: '伏線', desc: '伏線トラッカー（最大5,000字）' },
              ].map((c) => (
                <div
                  key={c.label}
                  title={c.desc}
                  style={{
                    padding: '3px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    fontSize: '11px',
                    color: 'var(--text-mid)',
                    cursor: 'default',
                  }}
                >
                  {c.label}
                </div>
              ))}
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.6' }}>
              ヒント: 各ソースにカーソルを合わせると文字数上限が表示されます。
            </p>
          </Section>

          {/* 作品のCore */}
          <Section title="作品のCore" icon="◎">
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: '1.7' }}>
              AIの「重力の中心」となる作品の核を定義します。設定するとAIはすべての問いをこのCoreを意識して返します。
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { label: 'テーマ', placeholder: '例: 赦しと再生', desc: '作品全体を貫く主題。' },
                { label: '中心感情', placeholder: '例: 静かな希望', desc: '読者に最終的に残したい感情。' },
                { label: '作品の問い', placeholder: '例: 人は過去の自分を赦せるか', desc: 'この作品が問いかける核心的な問い。' },
              ].map((f) => (
                <div key={f.label} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '11px', color: 'var(--accent)', width: '60px', flexShrink: 0, paddingTop: '2px', fontWeight: 600 }}>
                    {f.label}
                  </span>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                      {f.desc} <span style={{ opacity: 0.6 }}>{f.placeholder}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.6' }}>
              入力停止から3秒後に自動保存されます。
            </p>
          </Section>

          {/* 深掘りモード */}
          <Section title="深掘りモード（ソクラテス式）" icon="⬡">
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: '1.7' }}>
              AIが解決策を一切提示しない代わりに、一問ずつ深い問いを返すモードです。
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <InfoRow label="最大往復数" value="5往復（5往復目で締めくくりの問いに変わります）" />
              <InfoRow label="ルール" value="複数質問禁止。選択肢を与えない開かれた問いのみ。" />
              <InfoRow label="終了" value="「深掘り中 (n/5) — 終了」ボタンでいつでもリセット可能。" />
              <InfoRow label="使いどき" value="自分の思考を深く掘り下げたいとき。答えが出ずに止まっているとき。" />
            </div>
          </Section>

          {/* 停滞検知 */}
          <Section title="停滞検知（自動）" icon="✦">
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: '1.7' }}>
              執筆フェーズ中のみ動作します。書き詰まりのパターンを自動で検知し、AIに問いを求めるバナーを表示します。
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <InfoRow label="アイデア停滞" value="10分以上入力が止まったとき。" />
              <InfoRow label="構造停滞" value="同じ箇所への繰り返し編集・大量削除が検知されたとき。" />
              <InfoRow label="モチベーション停滞" value="タイピングリズムの著しい乱れが続いたとき。" />
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.6' }}>
              バナーの「問いを聞く」で即座にAIへ送信、「無視する」で非表示になります。
            </p>
          </Section>

          {/* クイックアクション */}
          <Section title="クイックアクション" icon="↺">
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.7' }}>
              フェーズ × 作家タイプの組み合わせに応じたプリセットプロンプトです。
              ボタンをクリックすると入力欄にテンプレートが挿入されます。送信前に自由に編集できます。
            </p>
          </Section>
        </div>

        {/* フッター */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={toggleAiManual}
            className="btn btn-primary"
            style={{ padding: '6px 20px', fontSize: '13px' }}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

// ── サブコンポーネント ──────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '10px',
          paddingBottom: '6px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{ fontSize: '10px', color: 'var(--accent)' }}>{icon}</span>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function PrincipleCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: '8px',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        marginBottom: '6px',
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', marginBottom: '4px' }}>{title}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.7' }}>{desc}</div>
    </div>
  );
}

function PhaseCard({
  phase, label, icon, desc,
}: {
  phase: 'explore' | 'structure' | 'write' | 'revise';
  label: string;
  icon: string;
  desc: string;
}) {
  const color = PHASE_COLORS[phase];
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: '8px',
        background: color.bg,
        border: `1px solid ${color.border}`,
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 600, color: color.accent, marginBottom: '4px' }}>
        <span style={{ marginRight: '5px', fontSize: '10px' }}>{icon}</span>{label}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.6' }}>{desc}</div>
    </div>
  );
}

function TypeCard({ label, desc }: { label: string; desc: string }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: '8px',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.6' }}>{desc}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <span
        style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          width: '110px',
          flexShrink: 0,
          paddingTop: '1px',
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: '11px', color: 'var(--text)', lineHeight: '1.6' }}>{value}</span>
    </div>
  );
}

/**
 * WritePhase — 執筆フェーズボディ（silent / mini / open の3段階）
 *
 * silent : 設定 UI 全廃。呼吸ランプ + 字数 + 章名、停滞バナー（条件付き）のみ
 * mini   : 細い 1 段の現状バー + 入力誘導文
 * open   : 「呼ばれて出てきました」カード + あなたへの問い
 */
import { useAiStore } from '@/shared/stores/aiStore';
import { useEditorStore } from '@/shared/stores/editorStore';
import type { BlockType } from '@/shared/types';
import { PHASE_COLORS } from '../phaseColors';
import { Lamp } from '../atoms/Lamp';
import { PromptCard } from '../atoms/PromptCard';
import { WRITE_PROMPTS } from '../phasePrompts';
import type { PhaseBodyProps } from '../types';

const accent = PHASE_COLORS.write.accent;

/** 停滞タイプ別のバナーメッセージ */
const STAGNATION_MESSAGES: Record<Exclude<BlockType, 'none'>, string> = {
  idea: '30秒ほど手が止まっています',
  structure: 'この場面で構造的な迷いを感じていますか',
  motivation: '少し書くのが重くなっていませんか',
};

/** 「問いをもらう」で送信する停滞別プロンプト */
const BLOCK_PROMPTS: Record<Exclude<BlockType, 'none'>, string> = {
  idea: 'アイデア停滞を感じています。創作を再起動する問いをください。',
  structure: '構造的な停滞を感じています。このシーンについて問いをください。',
  motivation: '少し書くのが重くなっています。小さく始められる問いをください。',
};

export function WritePhase({ chatRef, writeLevel }: PhaseBodyProps) {
  const detectedBlock = useAiStore((s) => s.detectedBlock);
  const setDetectedBlock = useAiStore((s) => s.setDetectedBlock);
  const currentEpisode = useEditorStore((s) => s.currentEpisode);

  const charCount = currentEpisode?.charCount ?? 0;
  const episodeTitle = currentEpisode?.title ?? '（章が未選択）';

  // ── silent: 静寂 ─────────────────────────────────
  if (writeLevel === 'silent') {
    return (
      <div
        style={{
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          animation: 'phaseEnter 480ms ease-out',
          flex: 1,
          minHeight: 0,
          justifyContent: 'center',
        }}
      >
        <Lamp size={22} accent={accent} />
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-heading)',
            letterSpacing: '0.18em',
            textAlign: 'center',
          }}
        >
          静かに見守り中
        </div>
        <div
          style={{
            fontSize: 10.5,
            color: 'var(--text-muted)',
            opacity: 0.7,
            textAlign: 'center',
            maxWidth: 220,
            lineHeight: 1.7,
          }}
        >
          必要なときだけ呼んでください。<br />
          書くことに集中してください。
        </div>

        <div
          style={{
            marginTop: 16,
            padding: '8px 14px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 999,
            display: 'flex',
            gap: 12,
            fontSize: 10.5,
            color: 'var(--text-muted)',
          }}
        >
          <span><span style={{ color: 'var(--text-mid)' }}>{charCount.toLocaleString()}</span> 字</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span style={{ color: accent }}>{episodeTitle}</span>
        </div>

        {detectedBlock !== 'none' && (
          <div
            style={{
              marginTop: 'auto',
              width: '100%',
              padding: 12,
              background: 'var(--bg-surface)',
              border: `1px solid ${accent}`,
              borderLeft: `3px solid ${accent}`,
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              animation: 'bannerSlideUp 360ms ease-out',
            }}
          >
            <div style={{ fontSize: 11, color: accent, fontWeight: 500 }}>
              ✦ {STAGNATION_MESSAGES[detectedBlock]}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-mid)', lineHeight: 1.6 }}>
              小さな問いを差し上げましょうか
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => {
                  chatRef.current?.sendMessage(BLOCK_PROMPTS[detectedBlock]);
                  setDetectedBlock('none');
                }}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  background: accent,
                  color: 'var(--bg-deep)',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                問いをもらう
              </button>
              <button
                type="button"
                onClick={() => setDetectedBlock('none')}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                いま要らない
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── mini: ミニ ───────────────────────────────────
  if (writeLevel === 'mini') {
    return (
      <div
        style={{
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          animation: 'phaseEnter 320ms ease-out',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 999,
          }}
        >
          <Lamp size={11} accent={accent} />
          <span style={{ fontSize: 11, color: 'var(--text-mid)', flex: 1 }}>静かに見守り中…</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{charCount.toLocaleString()} 字</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.8 }}>
          執筆に集中してください。必要なときだけ呼んでください。
        </div>
      </div>
    );
  }

  // ── open: 展開 ───────────────────────────────────
  return (
    <div
      style={{
        padding: '14px 14px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        animation: 'phaseEnter 320ms ease-out',
      }}
    >
      <div
        style={{
          padding: 10,
          background: 'var(--bg-surface)',
          border: `1px solid ${PHASE_COLORS.write.border}`,
          borderLeft: `2px solid ${accent}`,
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Lamp size={12} accent={accent} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, color: accent, fontWeight: 500, fontFamily: 'var(--font-heading)' }}>
            呼ばれて出てきました
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            用が済んだら「しまう」で見守りに戻れます
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.06em',
            color: 'var(--text-mid)',
            fontWeight: 600,
            fontFamily: 'var(--font-heading)',
          }}
        >
          あなたへの問い
        </div>
        {WRITE_PROMPTS.map((p) => (
          <PromptCard
            key={p.label}
            title={p.label}
            sub={p.sub}
            accent={accent}
            onClick={() => chatRef.current?.insertTemplate(p.prompt)}
          />
        ))}
      </div>
    </div>
  );
}

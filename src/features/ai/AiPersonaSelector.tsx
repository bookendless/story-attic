/**
 * ペルソナ・口調セレクター
 * AIの応答スタイルをセッション単位で切り替える。
 */

import { useAiStore } from '@/shared/stores/aiStore';
import type { AiPersona, AiTone } from '@/shared/types';

const PERSONAS: { value: AiPersona; label: string }[] = [
  { value: 'reader', label: '読者' },
  { value: 'editor', label: '編集者' },
  { value: 'assistant', label: 'アシスタント' },
];

const TONES: { value: AiTone; label: string }[] = [
  { value: 'formal', label: '丁寧' },
  { value: 'casual', label: 'カジュアル' },
  { value: 'harsh', label: '辛口' },
];

export function AiPersonaSelector() {
  const { persona, tone, setPersona, setTone } = useAiStore();

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      {/* ペルソナ選択 */}
      <div className="flex items-center gap-1">
        {PERSONAS.map((p) => (
          <button
            key={p.value}
            className="text-xs"
            style={{
              padding: '2px 7px',
              borderRadius: '8px',
              border: persona === p.value ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: persona === p.value ? 'var(--accent)' : 'transparent',
              color: persona === p.value ? 'var(--bg-deep)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 150ms',
              whiteSpace: 'nowrap',
            }}
            onClick={() => setPersona(p.value)}
            title={`ペルソナ: ${p.label}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <span style={{ color: 'var(--border)', fontSize: '10px' }}>|</span>

      {/* 口調選択 */}
      <div className="flex items-center gap-1">
        {TONES.map((t) => (
          <button
            key={t.value}
            className="text-xs"
            style={{
              padding: '2px 7px',
              borderRadius: '8px',
              border: tone === t.value ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: tone === t.value ? 'var(--accent)' : 'transparent',
              color: tone === t.value ? 'var(--bg-deep)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 150ms',
              whiteSpace: 'nowrap',
            }}
            onClick={() => setTone(t.value)}
            title={`口調: ${t.label}`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

import type { ProofreadSettings } from '@/shared/types';
import { Row, Section, Toggle } from '../atoms';

interface ProofreadPanelProps {
  draftProofread: ProofreadSettings;
  onProofreadChange: (patch: Partial<ProofreadSettings>) => void;
}

const CATEGORIES_INFO = [
  { key: '二重表現', desc: '「頭痛が痛い」のような重複' },
  { key: '誤用',     desc: '慣用句・語義の誤り' },
  { key: '冗長表現', desc: '「〜することができる」など' },
  { key: '記号',     desc: '全角/半角の混在など' },
];

export function ProofreadPanel({ draftProofread, onProofreadChange }: ProofreadPanelProps) {
  const enabled = draftProofread.enabled;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 校正機能 */}
      <Section title="校正機能">
        <Row label="校正をオンにする" desc="保存時に本文を自動解析">
          <Toggle
            checked={enabled}
            onChange={(v) => onProofreadChange({ enabled: v })}
          />
        </Row>
      </Section>

      {/* 検出カテゴリ */}
      <Section title="検出カテゴリ" collapsed={!enabled}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
          }}
        >
          {CATEGORIES_INFO.map((cat) => {
            const checked = draftProofread.categories[cat.key] ?? true;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() =>
                  onProofreadChange({
                    categories: { ...draftProofread.categories, [cat.key]: !checked },
                  })
                }
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                  background: checked ? 'var(--bg-elevated)' : 'var(--bg-deep)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 150ms, background 150ms',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{cat.key}</span>
                  <span style={{ fontSize: '14px', color: checked ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {checked ? '●' : '○'}
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{cat.desc}</span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* 表示 */}
      <Section title="表示" collapsed={!enabled}>
        <Row label="選択語句ポップアップ" desc="テキスト選択時に候補を表示">
          <Toggle
            checked={draftProofread.popup_enabled}
            onChange={(v) => onProofreadChange({ popup_enabled: v })}
            disabled={!enabled}
          />
        </Row>
      </Section>
    </div>
  );
}

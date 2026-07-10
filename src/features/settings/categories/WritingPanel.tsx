import type { ProjectSettings } from '@/shared/types';
import type { ThemeMode } from '@/shared/stores/uiStore';
import { Row, Section, Toggle, Slider, Select, ThemeCard, Chips } from '../atoms';

interface WritingPanelProps {
  draftProject: ProjectSettings;
  onProjectChange: (patch: Partial<ProjectSettings>) => void;
  draftTheme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}

const FONT_OPTIONS = [
  { kind: 'group' as const, group: '明朝体', items: [
    { value: '游明朝',          label: '游明朝' },
    { value: 'Noto Serif JP',   label: 'Noto Serif JP' },
    { value: 'Shippori Mincho', label: 'しっぽり明朝' },
    { value: 'Sawarabi Mincho', label: 'さわらび明朝' },
    { value: 'Zen Old Mincho',  label: 'Zen オールド明朝' },
    { value: 'BIZ UDMincho',    label: 'BIZ UD明朝' },
    { value: 'ヒラギノ明朝 ProN', label: 'ヒラギノ明朝' },
    { value: 'MS 明朝',          label: 'MS 明朝' },
  ]},
  { kind: 'group' as const, group: 'ゴシック体', items: [
    { value: 'Zen Kaku Gothic New', label: 'Zen 角ゴシック' },
    { value: 'Zen Maru Gothic',     label: 'Zen 丸ゴシック' },
    { value: 'Noto Sans JP',        label: 'Noto Sans JP' },
  ]},
  { kind: 'group' as const, group: '手書き風', items: [
    { value: 'Klee One', label: 'クレー' },
  ]},
];

const FORMAT_PRESETS = [
  { key: 'bunko',   label: '文庫本',  chars: 40, lines: 17 },
  { key: 'shinjin', label: '新人賞',  chars: 40, lines: 30 },
  { key: 'web',     label: 'Web小説', chars: 60, lines: 25 },
  { key: 'custom',  label: 'カスタム', chars: null, lines: null },
] as const;

function detectPreset(chars: number, lines: number): string {
  for (const p of FORMAT_PRESETS) {
    if (p.chars === chars && p.lines === lines) return p.key;
  }
  return 'custom';
}

export function WritingPanel({ draftProject, onProjectChange, draftTheme, onThemeChange }: WritingPanelProps) {
  const activePreset = detectPreset(draftProject.chars_per_line, draftProject.lines_per_page);

  const handlePreset = (key: string) => {
    const p = FORMAT_PRESETS.find((x) => x.key === key);
    if (p && p.chars !== null && p.lines !== null) {
      onProjectChange({ chars_per_line: p.chars, lines_per_page: p.lines });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* エディタ */}
      <Section title="エディタ">
        <Row label="自動字下げ" desc="段落頭に全角スペースを自動挿入">
          <Toggle
            checked={draftProject.auto_indent}
            onChange={(v) => onProjectChange({ auto_indent: v })}
          />
        </Row>
        <Row label="数字を直立（縦中横）" desc="縦書きで数字・略語を横倒しにせず直立表示">
          <Toggle
            checked={draftProject.vertical_tcy}
            onChange={(v) => onProjectChange({ vertical_tcy: v })}
          />
        </Row>
        <Row
          label="フォント"
          desc={
            <span>
              本文フォント —{' '}
              <span style={{ fontFamily: draftProject.editor_font }}>「こう見えます」</span>
            </span>
          }
        >
          <Select
            value={draftProject.editor_font}
            onChange={(v) => onProjectChange({ editor_font: v })}
            options={FONT_OPTIONS}
            width={180}
          />
        </Row>
        <Row label="フォントサイズ">
          <Slider
            value={draftProject.editor_font_size}
            onChange={(v) => onProjectChange({ editor_font_size: v })}
            min={12}
            max={28}
            format={(v) => `${v}px`}
          />
        </Row>
        <Row label="エディタ最大幅" desc="0で制限なし">
          <Slider
            value={draftProject.editor_max_width}
            onChange={(v) => onProjectChange({ editor_max_width: v })}
            min={0}
            max={1200}
            step={20}
            format={(v) => (v === 0 ? '制限なし' : `${v}px`)}
            width={160}
          />
        </Row>
      </Section>

      {/* 原稿フォーマット */}
      <Section title="原稿フォーマット">
        <Row label="プリセット">
          <Chips
            options={FORMAT_PRESETS.map((p) => ({ value: p.key, label: p.label }))}
            value={activePreset}
            onChange={handlePreset}
          />
        </Row>
        <Row label="1行の文字数">
          <input
            type="number"
            className="input text-sm"
            style={{ width: '72px', padding: '4px 8px' }}
            min={20}
            max={80}
            value={draftProject.chars_per_line}
            onChange={(e) => onProjectChange({ chars_per_line: Number(e.target.value) })}
          />
        </Row>
        <Row label="1ページの行数">
          <input
            type="number"
            className="input text-sm"
            style={{ width: '72px', padding: '4px 8px' }}
            min={10}
            max={50}
            value={draftProject.lines_per_page}
            onChange={(e) => onProjectChange({ lines_per_page: Number(e.target.value) })}
          />
        </Row>
      </Section>

      {/* 見た目 */}
      <Section title="見た目">
        <Row label="カラーテーマ">
          <div style={{ display: 'flex', gap: '10px' }}>
            <ThemeCard
              name="dark"
              label="ダーク"
              sub="屋根裏"
              active={draftTheme === 'dark'}
              onClick={() => onThemeChange('dark')}
              palette={{ bg: '#1a1814', text: '#e8e0d0', textMid: '#8a8070', accent: '#c8a96e' }}
            />
            <ThemeCard
              name="light"
              label="ライト"
              sub="和紙"
              active={draftTheme === 'light'}
              onClick={() => onThemeChange('light')}
              palette={{ bg: '#f5f0e8', text: '#2a2520', textMid: '#6a6058', accent: '#8b5e3c' }}
            />
          </div>
        </Row>
        <Row label="文字数カウント表示">
          <Toggle
            checked={draftProject.show_char_count}
            onChange={(v) => onProjectChange({ show_char_count: v })}
          />
        </Row>
      </Section>
    </div>
  );
}

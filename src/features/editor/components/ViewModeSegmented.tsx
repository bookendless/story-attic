/**
 * ビューモード セグメントコントロール
 *
 * エディタ / 台詞 / プレビュー / デュアル を 1 クリックで切替できる。
 * 校正 / 差分 は稀用のためコマンドパレット側に配置。
 */

import { useUIStore, type EditorViewMode } from '@/shared/stores/uiStore';
import { useEditorStore } from '@/shared/stores/editorStore';

interface Item {
  key: EditorViewMode;
  label: string;
  shortcut?: string;
}

const ITEMS: Item[] = [
  { key: 'editor',   label: 'エディタ' },
  { key: 'dialogue', label: '台詞',     shortcut: 'Ctrl+Shift+L' },
  { key: 'preview',  label: 'プレビュー', shortcut: 'Ctrl+Shift+P' },
  { key: 'dual',     label: 'デュアル',   shortcut: 'Ctrl+Shift+D' },
];

export function ViewModeSegmented() {
  const { editorViewMode, setEditorViewMode } = useUIStore();
  const hasEpisode = useEditorStore((s) => !!s.currentEpisode);

  // proofread/diff の時は「エディタ」扱いで表示
  const current: EditorViewMode =
    editorViewMode === 'proofread' || editorViewMode === 'diff' ? 'editor' : editorViewMode;

  return (
    <div
      className="flex items-center rounded-md overflow-hidden"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        height: '30px',
      }}
    >
      {ITEMS.map((item) => {
        const isActive = current === item.key;
        const disabled = !hasEpisode && item.key !== 'editor';
        return (
          <button
            key={item.key}
            disabled={disabled}
            onClick={() => setEditorViewMode(item.key)}
            title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
            style={{
              padding: '0 12px',
              height: '100%',
              background: isActive ? 'var(--accent-soft)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--text-mid)',
              border: 'none',
              borderRight: '1px solid var(--border)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontFamily: 'var(--font-ui)',
              opacity: disabled ? 0.4 : 1,
              transition: 'background 120ms',
            }}
            onMouseEnter={(e) => {
              if (!isActive && !disabled) (e.currentTarget as HTMLElement).style.background = 'var(--bg)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

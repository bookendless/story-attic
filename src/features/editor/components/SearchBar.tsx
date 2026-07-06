import { useState, useEffect, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { useUIStore } from '@/shared/stores/uiStore';

interface Props {
  editor: Editor;
}

/** 検索置換拡張の storage（@sereneinserenade/tiptap-search-and-replace） */
interface SearchStorage {
  results: { from: number; to: number }[];
  resultIndex: number;
}

/** 検索オプションのトグルチップ */
function OptionToggle({
  active,
  onClick,
  label,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      style={{
        padding: '2px 6px',
        fontSize: '11px',
        fontFamily: 'monospace',
        borderRadius: '4px',
        border: '1px solid',
        borderColor: active ? 'var(--accent)' : 'var(--border)',
        background: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

export function SearchBar({ editor }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [regexMode, setRegexMode] = useState(false);
  const [invalidRegex, setInvalidRegex] = useState(false);
  const [resultInfo, setResultInfo] = useState({ index: 0, total: 0 });
  const { toggleSearchBar } = useUIStore();

  // 拡張オプションの disableRegex を書き換える。
  // プラグインは検索処理のたびに options を参照するため実行時変更が効く
  const setExtensionRegexEnabled = useCallback((enabled: boolean) => {
    const ext = editor.extensionManager.extensions.find((e) => e.name === 'searchAndReplace');
    if (ext) (ext.options as { disableRegex: boolean }).disableRegex = !enabled;
  }, [editor]);

  // 検索語を適用する。正規表現モードで不正なパターンは赤枠表示して検索を止める
  const applySearch = useCallback((term: string, useRegex: boolean) => {
    if (useRegex && term) {
      try {
        new RegExp(term);
      } catch {
        setInvalidRegex(true);
        editor.commands.setSearchTerm('');
        return;
      }
    }
    setInvalidRegex(false);
    editor.commands.setSearchTerm(term);
  }, [editor]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    applySearch(value, regexMode);
  };

  const handleToggleCase = () => {
    const next = !caseSensitive;
    setCaseSensitive(next);
    editor.commands.setCaseSensitive(next);
  };

  const handleToggleRegex = () => {
    const next = !regexMode;
    setRegexMode(next);
    setExtensionRegexEnabled(next);
    // options 変更だけでは再検索されないため、検索語を入れ直して再評価させる
    editor.commands.setSearchTerm('');
    applySearch(searchTerm, next);
  };

  // ヒット件数「n / m」をエディタのトランザクションから購読する
  useEffect(() => {
    const update = () => {
      const storage = editor.storage.searchAndReplace as SearchStorage | undefined;
      if (!storage) return;
      setResultInfo({
        index: storage.results.length > 0 ? storage.resultIndex + 1 : 0,
        total: storage.results.length,
      });
    };
    update();
    editor.on('transaction', update);
    return () => {
      editor.off('transaction', update);
    };
  }, [editor]);

  // バーを閉じる（アンマウント）時に検索オプションを既定へ戻す
  useEffect(() => {
    return () => {
      if (editor.isDestroyed) return;
      setExtensionRegexEnabled(false);
      editor.commands.setCaseSensitive(false);
    };
  }, [editor, setExtensionRegexEnabled]);

  const closeSearchBar = () => {
    editor.commands.setSearchTerm('');
    toggleSearchBar();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeSearchBar();
      return;
    }
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        editor.commands.previousSearchResult();
      } else {
        editor.commands.nextSearchResult();
      }
    }
  };

  const handleReplace = () => {
    editor.commands.setReplaceTerm(replaceTerm);
    editor.commands.replace();
  };

  const handleReplaceAll = () => {
    editor.commands.setReplaceTerm(replaceTerm);
    editor.commands.replaceAll();
  };

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 flex-shrink-0 border-b"
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
    >
      <input
        className="input text-sm"
        style={{
          width: '200px',
          height: '28px',
          padding: '2px 8px',
          ...(invalidRegex ? { borderColor: 'var(--danger)', outlineColor: 'var(--danger)' } : {}),
        }}
        placeholder={regexMode ? '検索 (正規表現)' : '検索'}
        value={searchTerm}
        onChange={(e) => handleSearch(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="検索語"
        aria-invalid={invalidRegex}
        title={invalidRegex ? '正規表現が不正です' : undefined}
        autoFocus
      />

      {/* 検索オプション */}
      <OptionToggle
        active={caseSensitive}
        onClick={handleToggleCase}
        label="Aa"
        title="大文字と小文字を区別"
      />
      <OptionToggle
        active={regexMode}
        onClick={handleToggleRegex}
        label=".*"
        title="正規表現を使用"
      />

      {/* ヒット件数 */}
      <span
        aria-live="polite"
        style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '48px', textAlign: 'center' }}
      >
        {searchTerm ? (resultInfo.total > 0 ? `${resultInfo.index} / ${resultInfo.total}` : '0 件') : ''}
      </span>

      <button
        className="btn btn-ghost text-xs"
        style={{ padding: '2px 8px' }}
        onClick={() => editor.commands.previousSearchResult()}
        title="前の結果 (Shift+Enter)"
        aria-label="前の検索結果"
      >
        ↑
      </button>
      <button
        className="btn btn-ghost text-xs"
        style={{ padding: '2px 8px' }}
        onClick={() => editor.commands.nextSearchResult()}
        title="次の結果 (Enter)"
        aria-label="次の検索結果"
      >
        ↓
      </button>

      <span style={{ color: 'var(--border-light)' }}>|</span>

      <input
        className="input text-sm"
        style={{ width: '200px', height: '28px', padding: '2px 8px' }}
        placeholder="置換"
        value={replaceTerm}
        onChange={(e) => setReplaceTerm(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="置換語"
      />
      <button
        className="btn btn-ghost text-xs"
        style={{ padding: '2px 8px' }}
        onClick={handleReplace}
      >
        置換
      </button>
      <button
        className="btn btn-ghost text-xs"
        style={{ padding: '2px 8px' }}
        onClick={handleReplaceAll}
      >
        すべて置換
      </button>

      <button
        className="btn btn-ghost text-xs ml-auto"
        style={{ padding: '2px 8px' }}
        onClick={closeSearchBar}
        aria-label="検索バーを閉じる"
      >
        ✕
      </button>
    </div>
  );
}

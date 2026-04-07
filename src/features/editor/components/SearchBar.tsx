import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useUIStore } from '@/shared/stores/uiStore';

interface Props {
  editor: Editor;
}

export function SearchBar({ editor }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const { toggleSearchBar } = useUIStore();

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    editor.commands.setSearchTerm(value);
  };

  const handleReplace = () => {
    editor.commands.setReplaceTerm(replaceTerm);
    editor.commands.replace();
  };

  const handleReplaceAll = () => {
    editor.commands.setReplaceTerm(replaceTerm);
    editor.commands.replaceAll();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      editor.commands.setSearchTerm('');
      toggleSearchBar();
    }
    if (e.key === 'Enter') {
      editor.commands.nextSearchResult();
    }
  };

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 flex-shrink-0 border-b"
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
    >
      <input
        className="input text-sm"
        style={{ width: '200px', height: '28px', padding: '2px 8px' }}
        placeholder="検索"
        value={searchTerm}
        onChange={(e) => handleSearch(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
      />
      <button
        className="btn btn-ghost text-xs"
        style={{ padding: '2px 8px' }}
        onClick={() => editor.commands.previousSearchResult()}
        title="前の結果 (Shift+Enter)"
      >
        ↑
      </button>
      <button
        className="btn btn-ghost text-xs"
        style={{ padding: '2px 8px' }}
        onClick={() => editor.commands.nextSearchResult()}
        title="次の結果 (Enter)"
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
        onClick={() => {
          editor.commands.setSearchTerm('');
          toggleSearchBar();
        }}
      >
        ✕
      </button>
    </div>
  );
}

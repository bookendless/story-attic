/**
 * コマンドパレット
 *
 * Ctrl+P で起動する全機能への統一入口。
 * 稀に使う機能（文章分析・校正・差分・設定・エクスポート等）を
 * キーワード検索で一発起動できるようにする。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useUIStore } from '@/shared/stores/uiStore';
import { useEditorStore } from '@/shared/stores/editorStore';
import { getCommands, filterCommands, type Command } from '@/shared/commands/commands';

export function CommandPalette() {
  const commandPaletteVisible = useUIStore((s) => s.commandPaletteVisible);
  const toggleCommandPalette = useUIStore((s) => s.toggleCommandPalette);
  const hasEpisode = useEditorStore((s) => !!s.currentEpisode);

  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 有効なコマンドのリスト (エピソード未選択時は requiresEpisode を除外)
  const commands = useMemo(() => {
    if (!commandPaletteVisible) return [];
    return getCommands().filter((c) => hasEpisode || !c.requiresEpisode);
  }, [commandPaletteVisible, hasEpisode]);

  const filtered = useMemo(() => filterCommands(commands, query), [commands, query]);

  // 表示時に初期化
  useEffect(() => {
    if (commandPaletteVisible) {
      setQuery('');
      setSelectedIdx(0);
      // autofocus
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [commandPaletteVisible]);

  // クエリ変更時にカーソルを先頭へ
  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  // 選択項目が見えるようスクロール
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${selectedIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  if (!commandPaletteVisible) return null;

  const runCommand = (cmd: Command) => {
    toggleCommandPalette();
    // 次のティックで実行（パレットを閉じてから状態変更）
    setTimeout(() => cmd.run(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filtered[selectedIdx];
      if (cmd) runCommand(cmd);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      toggleCommandPalette();
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-start justify-center"
      style={{
        background: 'rgba(0,0,0,0.4)',
        zIndex: 200,
        paddingTop: '12vh',
      }}
      onClick={toggleCommandPalette}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '560px',
          maxWidth: '90vw',
          maxHeight: '70vh',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* 検索入力 */}
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="コマンドを検索... (例: 分析, 設定, 縦書き)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontSize: '14px',
              fontFamily: 'var(--font-ui)',
            }}
          />
        </div>

        {/* 結果一覧 */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '4px 0',
          }}
        >
          {filtered.length === 0 ? (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '12px',
              }}
            >
              該当するコマンドが見つかりません
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const isSelected = idx === selectedIdx;
              return (
                <button
                  key={cmd.id}
                  data-idx={idx}
                  onClick={() => runCommand(cmd)}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 14px',
                    background: isSelected ? 'var(--accent-soft)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: isSelected ? 'var(--text)' : 'var(--text-mid)',
                    fontSize: '13px',
                    textAlign: 'left',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      minWidth: '52px',
                      opacity: 0.7,
                    }}
                  >
                    {cmd.group}
                  </span>
                  <span style={{ flex: 1 }}>{cmd.label}</span>
                  {cmd.shortcut && (
                    <span
                      style={{
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        opacity: 0.6,
                      }}
                    >
                      {cmd.shortcut}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* フッターヒント */}
        <div
          style={{
            padding: '6px 14px',
            borderTop: '1px solid var(--border)',
            fontSize: '10px',
            color: 'var(--text-muted)',
            display: 'flex',
            gap: '14px',
          }}
        >
          <span>↑↓ 選択</span>
          <span>Enter 実行</span>
          <span>Esc 閉じる</span>
        </div>
      </div>
    </div>
  );
}

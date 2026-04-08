/**
 * 選択語句ポップアップ — エディタ上でテキスト選択時に
 * 用語集・キャラクター・資料をフロント側フィルタで検索し結果表示。
 *
 * 結果クリックで右パネルの該当タブ + アイテムを開く。
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import { useAppStore } from '@/shared/stores/appStore';
import { useUIStore } from '@/shared/stores/uiStore';
import type { Editor } from '@tiptap/react';
import type { Character, GlossaryItem, Material } from '@/shared/types';

interface SelectionPopupProps {
  editor: Editor;
}

interface SearchResult {
  type: 'character' | 'glossary' | 'material';
  id: string;
  label: string;
  sub?: string;
}

export function SelectionPopup({ editor }: SelectionPopupProps) {
  const projectId = useAppStore((s) => s.currentProjectId);
  const { openRightPanelTab } = useUIStore();
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const popupRef = useRef<HTMLDivElement>(null);

  // データキャッシュ
  const cacheRef = useRef<{
    characters: Character[];
    glossary: GlossaryItem[];
    materials: Material[];
    loaded: boolean;
  }>({ characters: [], glossary: [], materials: [], loaded: false });

  const loadCache = useCallback(async () => {
    if (!projectId || cacheRef.current.loaded) return;
    try {
      const [chars, gloss, mats] = await Promise.all([
        invoke<unknown[]>('get_characters', { projectId }),
        invoke<unknown[]>('get_glossary', { projectId }),
        invoke<unknown[]>('get_materials', { projectId }),
      ]);
      cacheRef.current = {
        characters: toCamelCase<Character[]>(chars),
        glossary: toCamelCase<GlossaryItem[]>(gloss),
        materials: toCamelCase<Material[]>(mats),
        loaded: true,
      };
    } catch { /* 無視 */ }
  }, [projectId]);

  // プロジェクト変更時にキャッシュをリセット
  useEffect(() => {
    cacheRef.current = { characters: [], glossary: [], materials: [], loaded: false };
  }, [projectId]);

  // テキスト選択を監視
  useEffect(() => {
    const handleSelection = () => {
      const { from, to } = editor.state.selection;
      if (from === to) {
        setVisible(false);
        return;
      }

      const text = editor.state.doc.textBetween(from, to, ' ').trim();
      if (!text || text.length < 1 || text.length > 30) {
        setVisible(false);
        return;
      }

      // 選択範囲の座標を取得
      const view = editor.view;
      const coords = view.coordsAtPos(from);
      setPos({ x: coords.left, y: coords.top - 4 });
      setQuery(text);
      setVisible(true);
      loadCache();
    };

    editor.on('selectionUpdate', handleSelection);
    return () => { editor.off('selectionUpdate', handleSelection); };
  }, [editor, loadCache]);

  // フィルタ検索
  useEffect(() => {
    if (!visible || !query) {
      setResults([]);
      return;
    }
    const q = query.toLowerCase();
    const hits: SearchResult[] = [];

    for (const c of cacheRef.current.characters) {
      if (c.name.toLowerCase().includes(q)) {
        hits.push({ type: 'character', id: c.id, label: c.name, sub: '人物' });
      }
    }
    for (const g of cacheRef.current.glossary) {
      if (g.term.toLowerCase().includes(q)) {
        hits.push({ type: 'glossary', id: g.id, label: g.term, sub: '用語' });
      }
    }
    for (const m of cacheRef.current.materials) {
      if (m.title.toLowerCase().includes(q)) {
        hits.push({ type: 'material', id: m.id, label: m.title, sub: '資料' });
      }
    }

    setResults(hits.slice(0, 8));
  }, [visible, query]);

  // 外側クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setVisible(false);
      }
    };
    if (visible) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [visible]);

  if (!visible || results.length === 0) return null;

  const tabMap: Record<string, 'character' | 'glossary' | 'material'> = {
    character: 'character',
    glossary: 'glossary',
    material: 'material',
  };

  return (
    <div
      ref={popupRef}
      style={{
        position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        transform: 'translateY(-100%)',
        zIndex: 1000,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        maxWidth: '240px',
        overflow: 'hidden',
      }}
    >
      <div className="px-2 py-1 text-xs" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
        「{query}」の検索結果
      </div>
      {results.map((r) => (
        <button
          key={`${r.type}-${r.id}`}
          className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-xs"
          style={{
            color: 'var(--text)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            borderBottom: '1px solid var(--border)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          onClick={() => {
            openRightPanelTab(tabMap[r.type]);
            setVisible(false);
          }}
        >
          <span className="truncate flex-1">{r.label}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{r.sub}</span>
        </button>
      ))}
    </div>
  );
}

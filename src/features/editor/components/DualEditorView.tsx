import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { EditorState } from '@tiptap/pm/state';
import { StarterKit } from '@tiptap/starter-kit';
import { useEditorStore } from '@/shared/stores/editorStore';
import { useUIStore } from '@/shared/stores/uiStore';
import { RubyNode } from '../extensions/RubyNode';
import { DotenMark } from '../extensions/DotenMark';
import { StatusBar } from './StatusBar';
import type { EpisodeSummary } from '@/shared/types';

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** 共通のTiptap拡張設定 */
function getExtensions() {
  return [
    StarterKit.configure({
      heading: false,
      blockquote: false,
      codeBlock: false,
      code: false,
      horizontalRule: false,
    }),
    RubyNode,
    DotenMark,
  ];
}

/** プライマリペイン（左: 現在のエピソード） */
function PrimaryPane() {
  const { currentEpisode, updateBody } = useEditorStore();
  const { settings, isTategaki } = useUIStore();
  const lastIdRef = useRef<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !isTategaki) return;
    const handler = (e: WheelEvent) => {
      const content = container.querySelector<HTMLElement>('.editor-content');
      if (!content) return;
      e.preventDefault();
      content.scrollLeft -= e.deltaY;
    };
    container.addEventListener('wheel', handler, { passive: false });
    return () => container.removeEventListener('wheel', handler);
  }, [isTategaki]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedUpdate = useCallback(
    debounce((html: string) => updateBody(html), 300),
    [updateBody],
  );

  const editor = useEditor({
    extensions: getExtensions(),
    content: currentEpisode?.body ?? '',
    editorProps: {
      attributes: {
        class: 'editor-content',
        spellcheck: 'false',
        style: [
          `font-family: ${settings.editor_font}, serif`,
          `font-size: ${settings.editor_font_size}px`,
        ].join('; ') + ';',
      },
    },
    onUpdate: ({ editor: ed }) => debouncedUpdate(ed.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    if (currentEpisode?.id === lastIdRef.current) return;
    lastIdRef.current = currentEpisode?.id ?? null;
    editor.commands.setContent(currentEpisode?.body ?? '', false);
    const freshState = EditorState.create({
      doc: editor.state.doc,
      plugins: editor.state.plugins,
    });
    editor.view.updateState(freshState);
  }, [editor, currentEpisode?.id, currentEpisode?.body]);

  return (
    <div className={`h-full flex flex-col ${isTategaki ? 'editor-tategaki' : ''}`}>
      <div
        className="flex-shrink-0 px-3 py-1.5 border-b text-xs"
        style={{
          borderColor: 'var(--border)',
          background: 'var(--bg-surface)',
          color: 'var(--accent)',
          fontFamily: 'var(--font-heading)',
        }}
      >
        {currentEpisode?.title ?? '未選択'}
      </div>
      <div ref={scrollContainerRef} className="flex-1 overflow-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>
      {settings.show_char_count && editor && <StatusBar editor={editor} />}
    </div>
  );
}

/** セカンダリペイン（右: 別のエピソード） */
function SecondaryPane() {
  const {
    chapterTree,
    currentEpisode,
    secondaryEpisode,
    secondaryIsDirty,
    switchSecondaryEpisode,
    updateSecondaryBody,
  } = useEditorStore();
  const { settings, isTategaki } = useUIStore();
  const lastIdRef = useRef<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !isTategaki) return;
    const handler = (e: WheelEvent) => {
      const content = container.querySelector<HTMLElement>('.editor-content');
      if (!content) return;
      e.preventDefault();
      content.scrollLeft -= e.deltaY;
    };
    container.addEventListener('wheel', handler, { passive: false });
    return () => container.removeEventListener('wheel', handler);
  }, [isTategaki]);

  const availableEpisodes = useMemo(() => {
    if (!chapterTree) return [];
    const all: EpisodeSummary[] = [];
    for (const ch of chapterTree.chapters) all.push(...ch.episodes);
    all.push(...chapterTree.ungrouped);
    return all.filter((ep) => ep.id !== currentEpisode?.id);
  }, [chapterTree, currentEpisode?.id]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedUpdate = useCallback(
    debounce((html: string) => updateSecondaryBody(html), 300),
    [updateSecondaryBody],
  );

  const editor = useEditor({
    extensions: getExtensions(),
    content: secondaryEpisode?.body ?? '',
    editorProps: {
      attributes: {
        class: 'editor-content',
        spellcheck: 'false',
        style: [
          `font-family: ${settings.editor_font}, serif`,
          `font-size: ${settings.editor_font_size}px`,
        ].join('; ') + ';',
      },
    },
    onUpdate: ({ editor: ed }) => debouncedUpdate(ed.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    if (secondaryEpisode?.id === lastIdRef.current) return;
    lastIdRef.current = secondaryEpisode?.id ?? null;
    editor.commands.setContent(secondaryEpisode?.body ?? '', false);
    const freshState = EditorState.create({
      doc: editor.state.doc,
      plugins: editor.state.plugins,
    });
    editor.view.updateState(freshState);
  }, [editor, secondaryEpisode?.id, secondaryEpisode?.body]);

  return (
    <div className={`h-full flex flex-col ${isTategaki ? 'editor-tategaki' : ''}`}>
      {/* エピソード選択ヘッダー */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
      >
        <select
          className="input text-xs flex-1"
          style={{ padding: '2px 6px', height: '24px' }}
          value={secondaryEpisode?.id ?? ''}
          onChange={(e) => {
            if (e.target.value) void switchSecondaryEpisode(e.target.value);
          }}
        >
          <option value="">話を選択...</option>
          {availableEpisodes.map((ep) => (
            <option key={ep.id} value={ep.id}>{ep.title}</option>
          ))}
        </select>
        {secondaryIsDirty && (
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--warning)' }}>●</span>
        )}
      </div>

      {/* エディタ */}
      {secondaryEpisode ? (
        <>
          <div ref={scrollContainerRef} className="flex-1 overflow-auto">
            <EditorContent editor={editor} className="h-full" />
          </div>
          {settings.show_char_count && editor && <StatusBar editor={editor} />}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
          右側に表示する話を選択
        </div>
      )}
    </div>
  );
}

export function DualEditorView() {
  const [splitRatio, setSplitRatio] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitRatio(Math.max(25, Math.min(75, ratio)));
    };
    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div ref={containerRef} className="h-full flex" style={{ background: 'var(--bg)' }}>
      {/* 左ペイン */}
      <div className="overflow-hidden" style={{ width: `${splitRatio}%` }}>
        <PrimaryPane />
      </div>

      {/* リサイズハンドル */}
      <div
        className="flex-shrink-0 dual-resize-handle"
        style={{
          width: '5px',
          cursor: 'col-resize',
          background: 'var(--border)',
        }}
        onMouseDown={handleMouseDown}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'var(--accent)';
        }}
        onMouseLeave={(e) => {
          if (!isDragging.current) {
            (e.currentTarget as HTMLElement).style.background = 'var(--border)';
          }
        }}
      />

      {/* 右ペイン */}
      <div className="overflow-hidden" style={{ width: `${100 - splitRatio}%` }}>
        <SecondaryPane />
      </div>
    </div>
  );
}

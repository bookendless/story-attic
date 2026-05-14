/**
 * タイムラインテーブル — スプレッドシート型UI
 *
 * タイムライン選択 → セル編集・行列追加/削除・名称変更。
 * data JSON にセル配列を格納。
 */

import { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Timeline, TimelineData, TimelineCell } from '@/shared/types';
import { DEFAULT_TIMELINE_DATA } from '@/shared/types';

interface TimelineTableProps {
  projectId: string;
  timelines: Timeline[];
  onReload: () => void;
  isModal?: boolean;
  onExpand?: () => void;
}

export interface TimelineTableHandle {
  flush: () => Promise<void>;
}

function parseData(raw: string): TimelineData {
  try {
    const parsed = JSON.parse(raw);
    return {
      headers: Array.isArray(parsed.headers) ? parsed.headers : DEFAULT_TIMELINE_DATA.headers,
      rows: Array.isArray(parsed.rows) ? parsed.rows : [],
    };
  } catch {
    return { ...DEFAULT_TIMELINE_DATA, rows: [] };
  }
}

export const TimelineTable = forwardRef<TimelineTableHandle, TimelineTableProps>(
  function TimelineTable({ projectId, timelines, onReload, isModal = false, onExpand }, ref) {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [data, setData] = useState<TimelineData>({ ...DEFAULT_TIMELINE_DATA, rows: [] });
    const [editingTitle, setEditingTitle] = useState('');
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingRef = useRef<{ id: string; data: TimelineData } | null>(null);

    const defaultColWidth = isModal ? 160 : 100;
    const [columnWidths, setColumnWidths] = useState<number[]>(() =>
      Array.from({ length: data.headers.length }, () => defaultColWidth)
    );
    const dragRef = useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null);

    const selectedTimeline = timelines.find((t) => t.id === selectedId) ?? null;

    useImperativeHandle(ref, () => ({
      flush: async () => {
        if (saveTimer.current && pendingRef.current) {
          clearTimeout(saveTimer.current);
          saveTimer.current = null;
          const pending = pendingRef.current;
          pendingRef.current = null;
          try {
            await invoke('save_timeline', { id: pending.id, data: JSON.stringify(pending.data) });
          } catch { /* 無視 */ }
        }
      },
    }));

    // ヘッダー数変化時にcolumnWidthsを同期
    useEffect(() => {
      setColumnWidths((prev) => {
        if (prev.length === data.headers.length) return prev;
        if (prev.length < data.headers.length) {
          return [...prev, ...Array(data.headers.length - prev.length).fill(defaultColWidth)];
        }
        return prev.slice(0, data.headers.length);
      });
    }, [data.headers.length, defaultColWidth]);

    // 列リサイズ開始
    const handleResizeStart = useCallback((e: React.MouseEvent, colIdx: number) => {
      e.preventDefault();
      dragRef.current = { colIdx, startX: e.clientX, startWidth: columnWidths[colIdx] ?? defaultColWidth };

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = ev.clientX - dragRef.current.startX;
        const newWidth = Math.max(60, dragRef.current.startWidth + delta);
        setColumnWidths((prev) => prev.map((w, i) => i === dragRef.current!.colIdx ? newWidth : w));
      };

      const onMouseUp = () => {
        dragRef.current = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }, [columnWidths, defaultColWidth]);

    const selectTimeline = (tl: Timeline) => {
      setSelectedId(tl.id);
      setData(parseData(tl.data));
      setEditingTitle(tl.title);
    };

    useEffect(() => {
      if (selectedTimeline) {
        setData(parseData(selectedTimeline.data));
        setEditingTitle(selectedTimeline.title);
      }
    }, [selectedTimeline]);

    const handleCreate = useCallback(async () => {
      try {
        await invoke<string>('create_timeline', { projectId, chapterId: null });
        onReload();
      } catch { /* 無視 */ }
    }, [projectId, onReload]);

    const handleDelete = useCallback(async (id: string) => {
      try {
        await invoke('delete_timeline', { id });
        if (selectedId === id) { setSelectedId(null); setData({ ...DEFAULT_TIMELINE_DATA, rows: [] }); }
        onReload();
      } catch { /* 無視 */ }
    }, [selectedId, onReload]);

    const handleRenameBlur = useCallback(async () => {
      if (!selectedTimeline) return;
      try {
        await invoke('rename_timeline', { id: selectedTimeline.id, title: editingTitle });
        onReload();
      } catch { /* 無視 */ }
    }, [selectedTimeline, editingTitle, onReload]);

    const save = useCallback((newData: TimelineData) => {
      if (!selectedId) return;
      setData(newData);
      pendingRef.current = { id: selectedId, data: newData };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const pending = pendingRef.current;
        if (!pending) return;
        pendingRef.current = null;
        saveTimer.current = null;
        try {
          await invoke('save_timeline', { id: pending.id, data: JSON.stringify(pending.data) });
        } catch { /* 無視 */ }
      }, 500);
    }, [selectedId]);

    const updateCell = (rowIdx: number, colIdx: number, value: string) => {
      const newRows = data.rows.map((row, ri) =>
        ri === rowIdx ? row.map((cell, ci) => ci === colIdx ? { value } : cell) : row,
      );
      save({ ...data, rows: newRows });
    };

    const addRow = () => {
      const newRow: TimelineCell[] = data.headers.map(() => ({ value: '' }));
      save({ ...data, rows: [...data.rows, newRow] });
    };

    const removeRow = (rowIdx: number) => {
      save({ ...data, rows: data.rows.filter((_, i) => i !== rowIdx) });
    };

    const addColumn = () => {
      const newHeaders = [...data.headers, `列${data.headers.length + 1}`];
      const newRows = data.rows.map((row) => [...row, { value: '' }]);
      save({ headers: newHeaders, rows: newRows });
    };

    const removeColumn = (colIdx: number) => {
      if (data.headers.length <= 1) return;
      const newHeaders = data.headers.filter((_, i) => i !== colIdx);
      const newRows = data.rows.map((row) => row.filter((_, i) => i !== colIdx));
      save({ headers: newHeaders, rows: newRows });
    };

    const updateHeader = (colIdx: number, value: string) => {
      const newHeaders = data.headers.map((h, i) => i === colIdx ? value : h);
      save({ ...data, headers: newHeaders });
    };

    // タイムライン一覧（未選択時）
    if (!selectedTimeline) {
      return (
        <div className="flex flex-col h-full overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>タイムライン ({timelines.length})</span>
            <button
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: 'var(--accent)', color: 'var(--bg-deep)', border: 'none', cursor: 'pointer' }}
              onClick={handleCreate}
            >
              + 追加
            </button>
          </div>
          {timelines.length === 0 && (
            <div className="px-3 py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>タイムラインがありません</div>
          )}
          {timelines.map((tl, i) => (
            <div
              key={tl.id}
              className="flex items-center justify-between px-3 py-1.5 cursor-pointer"
              style={{ borderBottom: '1px solid var(--border)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              onClick={() => selectTimeline(tl)}
            >
              <span className="text-xs" style={{ color: 'var(--text)' }}>
                {tl.title || `タイムライン ${i + 1}`}
              </span>
              <button
                className="text-xs flex-shrink-0"
                style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                onClick={(e) => { e.stopPropagation(); handleDelete(tl.id); }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      );
    }

    const totalWidth = columnWidths.reduce((a, b) => a + b, 0) + 24;

    // スプレッドシート編集ビュー
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <button
            className="text-xs flex-shrink-0"
            style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => setSelectedId(null)}
          >
            ←
          </button>
          <input
            className="flex-1 text-xs font-medium bg-transparent outline-none"
            style={{
              color: 'var(--text)',
              border: 'none',
              borderBottom: '1px solid transparent',
              padding: '1px 2px',
            }}
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onBlur={handleRenameBlur}
            onFocus={(e) => (e.currentTarget.style.borderBottomColor = 'var(--accent)')}
            placeholder="タイムライン名..."
          />
          <button
            className="text-xs flex-shrink-0"
            style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={addColumn}
            title="列追加"
          >
            +列
          </button>
          <button
            className="text-xs flex-shrink-0"
            style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={addRow}
            title="行追加"
          >
            +行
          </button>
          {onExpand && (
            <button
              className="flex-shrink-0"
              style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}
              onClick={onExpand}
              title="全画面で開く"
            >
              ⤢
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: `${totalWidth}px` }}>
            <thead>
              <tr>
                {data.headers.map((h, ci) => (
                  <th
                    key={ci}
                    className={`${isModal ? 'text-sm' : 'text-xs'} font-medium`}
                    style={{
                      background: 'var(--bg)',
                      color: 'var(--text-mid)',
                      border: '1px solid var(--border)',
                      padding: '2px 4px',
                      position: 'sticky',
                      top: 0,
                      width: `${columnWidths[ci] ?? defaultColWidth}px`,
                      minWidth: '60px',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ position: 'relative' }}>
                      <div className="flex items-center gap-0.5">
                        <input
                          className="flex-1 text-xs font-medium bg-transparent outline-none"
                          style={{ color: 'var(--text-mid)', border: 'none', padding: 0, minWidth: '30px', width: '100%' }}
                          value={h}
                          onChange={(e) => updateHeader(ci, e.target.value)}
                        />
                        {data.headers.length > 1 && (
                          <button
                            className="text-xs flex-shrink-0"
                            style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '9px', opacity: 0.6 }}
                            onClick={() => removeColumn(ci)}
                          >
                            ×
                          </button>
                        )}
                      </div>
                      {/* 列リサイズハンドル */}
                      <div
                        onMouseDown={(e) => handleResizeStart(e, ci)}
                        style={{
                          position: 'absolute',
                          right: '-6px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: '12px',
                          height: '20px',
                          cursor: 'col-resize',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 2,
                        }}
                        title="ドラッグで列幅変更"
                      >
                        <div style={{
                          width: '2px',
                          height: '12px',
                          background: 'var(--border-light)',
                          borderRadius: '1px',
                          transition: 'background 150ms',
                        }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = 'var(--accent)')}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = 'var(--border-light)')}
                        />
                      </div>
                    </div>
                  </th>
                ))}
                <th style={{ width: '24px', border: '1px solid var(--border)', background: 'var(--bg)' }} />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{ border: '1px solid var(--border)', padding: 0, verticalAlign: 'top' }}>
                      {isModal ? (
                        <textarea
                          className="w-full bg-transparent outline-none text-sm"
                          style={{ color: 'var(--text)', border: 'none', padding: '4px 6px', resize: 'vertical', minHeight: '52px', display: 'block' }}
                          value={cell.value}
                          onChange={(e) => updateCell(ri, ci, e.target.value)}
                        />
                      ) : (
                        <textarea
                          className="w-full bg-transparent outline-none text-xs"
                          style={{ color: 'var(--text)', border: 'none', padding: '3px 4px', resize: 'vertical', minHeight: '26px', display: 'block' }}
                          value={cell.value}
                          onChange={(e) => updateCell(ri, ci, e.target.value)}
                          rows={1}
                        />
                      )}
                    </td>
                  ))}
                  <td style={{ border: '1px solid var(--border)', width: '24px', textAlign: 'center' }}>
                    <button
                      className="text-xs"
                      style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '9px' }}
                      onClick={() => removeRow(ri)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.rows.length === 0 && (
            <div className="px-3 py-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              行がありません。「+行」ボタンで追加してください。
            </div>
          )}
        </div>
      </div>
    );
  }
);

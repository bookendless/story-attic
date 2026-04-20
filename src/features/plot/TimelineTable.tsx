/**
 * タイムラインテーブル — スプレッドシート型UI
 *
 * タイムライン選択 → セル編集・行列追加/削除・名称変更。
 * data JSON にセル配列を格納。
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Timeline, TimelineData, TimelineCell } from '@/shared/types';
import { DEFAULT_TIMELINE_DATA } from '@/shared/types';

interface TimelineTableProps {
  projectId: string;
  timelines: Timeline[];
  onReload: () => void;
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

export function TimelineTable({ projectId, timelines, onReload }: TimelineTableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [data, setData] = useState<TimelineData>({ ...DEFAULT_TIMELINE_DATA, rows: [] });
  const [editingTitle, setEditingTitle] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedTimeline = timelines.find((t) => t.id === selectedId) ?? null;

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
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await invoke('save_timeline', { id: selectedId, data: JSON.stringify(newData) });
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
      </div>

      <div className="flex-1 overflow-auto">
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: `${data.headers.length * 100}px` }}>
          <thead>
            <tr>
              {data.headers.map((h, ci) => (
                <th
                  key={ci}
                  className="text-xs font-medium"
                  style={{
                    background: 'var(--bg)',
                    color: 'var(--text-mid)',
                    border: '1px solid var(--border)',
                    padding: '2px 4px',
                    position: 'sticky',
                    top: 0,
                    minWidth: '80px',
                  }}
                >
                  <div className="flex items-center gap-0.5">
                    <input
                      className="flex-1 text-xs font-medium bg-transparent outline-none"
                      style={{ color: 'var(--text-mid)', border: 'none', padding: 0, minWidth: '40px' }}
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
                </th>
              ))}
              <th style={{ width: '24px', border: '1px solid var(--border)', background: 'var(--bg)' }} />
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ border: '1px solid var(--border)', padding: 0 }}>
                    <input
                      className="w-full text-xs bg-transparent outline-none"
                      style={{ color: 'var(--text)', border: 'none', padding: '3px 4px' }}
                      value={cell.value}
                      onChange={(e) => updateCell(ri, ci, e.target.value)}
                    />
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

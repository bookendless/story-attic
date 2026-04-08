/**
 * プロット構造設定 — テーマ・対立構造・結末のフォーム
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { PlotStructureData } from '@/shared/types';
import { DEFAULT_PLOT_STRUCTURE_DATA } from '@/shared/types';

interface PlotStructureEditorProps {
  projectId: string;
}

const FIELDS: { key: keyof PlotStructureData; label: string; multiline: boolean }[] = [
  { key: 'theme', label: 'テーマ', multiline: false },
  { key: 'protagonist', label: '主人公', multiline: false },
  { key: 'antagonist', label: '敵対者', multiline: false },
  { key: 'conflict', label: '対立構造', multiline: true },
  { key: 'ending', label: '結末', multiline: true },
  { key: 'notes', label: 'メモ', multiline: true },
];

function parseData(raw: string): PlotStructureData {
  try {
    return { ...DEFAULT_PLOT_STRUCTURE_DATA, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PLOT_STRUCTURE_DATA };
  }
}

export function PlotStructureEditor({ projectId }: PlotStructureEditorProps) {
  const [data, setData] = useState<PlotStructureData>({ ...DEFAULT_PLOT_STRUCTURE_DATA });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await invoke<{ project_id: string; data: string }>('get_plot_structure', { projectId });
        setData(parseData(result.data));
      } catch { /* 無視 */ }
    })();
  }, [projectId]);

  const save = useCallback((newData: PlotStructureData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await invoke('save_plot_structure', { projectId, data: JSON.stringify(newData) });
      } catch { /* 無視 */ }
    }, 500);
  }, [projectId]);

  const update = (key: keyof PlotStructureData, value: string) => {
    const newData = { ...data, [key]: value };
    setData(newData);
    save(newData);
  };

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2">
      <div className="flex flex-col gap-2">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <span className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>{f.label}</span>
            {f.multiline ? (
              <textarea
                className="w-full text-xs bg-transparent outline-none resize-none"
                style={{ color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 6px', minHeight: '60px' }}
                value={data[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
              />
            ) : (
              <input
                className="w-full text-xs bg-transparent outline-none"
                style={{ color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px' }}
                value={data[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

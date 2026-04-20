/**
 * プロットパネル — 右パネル内の「プロット」タブ
 *
 * サブタブ: プロットツリー / 構造設定
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import { useAppStore } from '@/shared/stores/appStore';
import type { Plot } from '@/shared/types';
import { PlotTree } from './PlotTree';
import { PlotStructureEditor } from './PlotStructureEditor';

type SubTab = 'tree' | 'structure';

export function PlotPanel() {
  const projectId = useAppStore((s) => s.currentProjectId);
  const [subTab, setSubTab] = useState<SubTab>('tree');
  const [plots, setPlots] = useState<Plot[]>([]);

  const loadPlots = useCallback(async () => {
    if (!projectId) return;
    try {
      const result = await invoke<unknown[]>('get_plots', { projectId });
      setPlots(toCamelCase<Plot[]>(result));
    } catch { /* 無視 */ }
  }, [projectId]);

  useEffect(() => {
    loadPlots();
  }, [loadPlots]);

  if (!projectId) return null;

  return (
    <div className="flex flex-col h-full">
      {/* サブタブバー */}
      <div className="flex items-center gap-0.5 px-2 pt-1 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        {([['tree', 'プロット'], ['structure', '構造設定']] as [SubTab, string][]).map(([key, label]) => (
          <button
            key={key}
            className="text-xs px-2 py-1 whitespace-nowrap"
            style={{
              color: subTab === key ? 'var(--accent)' : 'var(--text-muted)',
              background: 'none', border: 'none',
              borderBottom: subTab === key ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
            }}
            onClick={() => setSubTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-hidden">
        {subTab === 'tree' && (
          <PlotTree projectId={projectId} plots={plots} onReload={loadPlots} />
        )}
        {subTab === 'structure' && (
          <PlotStructureEditor projectId={projectId} />
        )}
      </div>
    </div>
  );
}

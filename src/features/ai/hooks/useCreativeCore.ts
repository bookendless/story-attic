/**
 * useCreativeCore — 作品の Core（テーマ・中心感情・問い）の編集と自動保存。
 * 旧 CreativeCoreEditor の保存ロジックを抽出したもの。
 * 入力停止 3 秒後に plot_structure へ自動保存する。
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/shared/stores/appStore';
import { useAiStore } from '@/shared/stores/aiStore';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import type { PlotStructure, PlotStructureData, CreativeCore } from '@/shared/types';
import { DEFAULT_PLOT_STRUCTURE_DATA } from '@/shared/types';

export type CoreSaveStatus = 'idle' | 'saving' | 'saved';

export interface UseCreativeCoreResult {
  localCore: CreativeCore;
  saveStatus: CoreSaveStatus;
  hasCore: boolean;
  handleFieldChange: (key: keyof CreativeCore, value: string) => void;
}

export function useCreativeCore(): UseCreativeCoreResult {
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const creativeCore = useAiStore((s) => s.creativeCore);
  const setCreativeCore = useAiStore((s) => s.setCreativeCore);
  const loadCreativeCore = useAiStore((s) => s.loadCreativeCore);

  const [saveStatus, setSaveStatus] = useState<CoreSaveStatus>('idle');
  const [localCore, setLocalCore] = useState<CreativeCore>(creativeCore);

  const isUserEditing = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // プロジェクト切替時に plot_structure から Core を読み込む
  useEffect(() => {
    if (!currentProjectId) return;
    isUserEditing.current = false;
    invoke<unknown>('get_plot_structure', { projectId: currentProjectId })
      .then((raw) => {
        const ps = toCamelCase<PlotStructure>(raw);
        let data: Partial<PlotStructureData> = {};
        try {
          data = JSON.parse(ps.data || '{}');
        } catch { /* パース失敗は無視 */ }
        const core: CreativeCore = {
          theme: data.theme ?? '',
          centralEmotion: data.centralEmotion ?? '',
          coreQuestion: data.coreQuestion ?? '',
        };
        loadCreativeCore(core);
        setLocalCore(core);
      })
      .catch(() => { /* 取得失敗は無視 */ });
  }, [currentProjectId, loadCreativeCore]);

  // ストアが外部から更新された場合にローカル状態を同期
  useEffect(() => {
    if (!isUserEditing.current) {
      setLocalCore(creativeCore);
    }
  }, [creativeCore]);

  const handleSave = useCallback(async () => {
    if (!currentProjectId) return;
    setSaveStatus('saving');
    try {
      const raw = await invoke<unknown>('get_plot_structure', { projectId: currentProjectId });
      const ps = toCamelCase<PlotStructure>(raw);
      let existing: PlotStructureData = { ...DEFAULT_PLOT_STRUCTURE_DATA };
      try {
        existing = { ...DEFAULT_PLOT_STRUCTURE_DATA, ...JSON.parse(ps.data || '{}') };
      } catch { /* パース失敗はデフォルト使用 */ }

      const merged: PlotStructureData = {
        ...existing,
        theme: localCore.theme,
        centralEmotion: localCore.centralEmotion,
        coreQuestion: localCore.coreQuestion,
      };

      await invoke('save_plot_structure', {
        projectId: currentProjectId,
        data: JSON.stringify(merged),
      });
      setCreativeCore(localCore);
    } catch {
      setCreativeCore(localCore);
    }

    setSaveStatus('saved');
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaveStatus('idle'), 1500);
  }, [currentProjectId, localCore, setCreativeCore]);

  // 入力停止 3 秒後に自動保存
  useEffect(() => {
    if (!isUserEditing.current) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { handleSave(); }, 3000);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [localCore, handleSave]);

  const handleFieldChange = useCallback((key: keyof CreativeCore, value: string) => {
    isUserEditing.current = true;
    setLocalCore((c) => ({ ...c, [key]: value }));
  }, []);

  const hasCore = Boolean(
    creativeCore.theme || creativeCore.centralEmotion || creativeCore.coreQuestion,
  );

  return { localCore, saveStatus, hasCore, handleFieldChange };
}

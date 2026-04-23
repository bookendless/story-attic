/**
 * Creative Gravity Engine — Creative Core 定義UI
 * 作品のテーマ・中心感情・作品の問いを定義し、AIの重力中心として永続化する。
 * 入力停止3秒後に自動保存。
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/shared/stores/appStore';
import { useAiStore } from '@/shared/stores/aiStore';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import type { PlotStructure, PlotStructureData } from '@/shared/types';
import { DEFAULT_PLOT_STRUCTURE_DATA } from '@/shared/types';

type SaveStatus = 'idle' | 'saving' | 'saved';

export function CreativeCoreEditor() {
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const { creativeCore, setCreativeCore, loadCreativeCore } = useAiStore();
  const [isOpen, setIsOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [localCore, setLocalCore] = useState(creativeCore);

  const isUserEditing = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // プロジェクト切り替え時に plot_structure からCoreを読み込む
  useEffect(() => {
    if (!currentProjectId) return;

    isUserEditing.current = false;
    invoke<unknown>('get_plot_structure', { projectId: currentProjectId })
      .then((raw) => {
        const ps = toCamelCase<PlotStructure>(raw);
        let data: Partial<PlotStructureData> = {};
        try {
          data = JSON.parse(ps.data || '{}');
        } catch {
          // パース失敗は無視
        }
        const core = {
          theme: data.theme ?? '',
          centralEmotion: data.centralEmotion ?? '',
          coreQuestion: data.coreQuestion ?? '',
        };
        loadCreativeCore(core);
        setLocalCore(core);
      })
      .catch(() => {
        // 取得失敗は無視
      });
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
      } catch {
        // パース失敗はデフォルト使用
      }

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

  // 入力停止3秒後に自動保存
  useEffect(() => {
    if (!isUserEditing.current) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      handleSave();
    }, 3000);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [localCore, handleSave]);

  const handleFieldChange = (key: keyof typeof localCore, value: string) => {
    isUserEditing.current = true;
    setLocalCore((c) => ({ ...c, [key]: value }));
  };

  const hasCore = creativeCore.theme || creativeCore.centralEmotion || creativeCore.coreQuestion;

  return (
    <div
      className="flex-shrink-0"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      {/* 折りたたみヘッダー */}
      <button
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          textAlign: 'left',
        }}
        onClick={() => setIsOpen((v) => !v)}
        title="作品のCore（重力の中心）を定義する"
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ fontSize: '10px' }}>{isOpen ? '▼' : '▶'}</span>
          <span>作品のCore</span>
          {hasCore && (
            <span
              style={{
                display: 'inline-block',
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: 'var(--accent)',
                flexShrink: 0,
              }}
            />
          )}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          {saveStatus === 'saving' && '保存中...'}
          {saveStatus === 'saved' && '保存済み'}
          {saveStatus === 'idle' && !isOpen && hasCore && (
            <span
              style={{
                maxWidth: '90px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'inline-block',
              }}
            >
              {creativeCore.theme || creativeCore.centralEmotion}
            </span>
          )}
        </span>
      </button>

      {/* 展開時の編集フォーム */}
      {isOpen && (
        <div className="px-3 pb-2.5">
          <div className="flex flex-col gap-1.5">
            <CoreField
              label="テーマ"
              placeholder="例: 赦しと再生"
              value={localCore.theme}
              onChange={(v) => handleFieldChange('theme', v)}
            />
            <CoreField
              label="中心感情"
              placeholder="例: 静かな希望"
              value={localCore.centralEmotion}
              onChange={(v) => handleFieldChange('centralEmotion', v)}
            />
            <CoreField
              label="作品の問い"
              placeholder="例: 人は過去の自分を赦せるか"
              value={localCore.coreQuestion}
              onChange={(v) => handleFieldChange('coreQuestion', v)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CoreField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        style={{
          fontSize: '10px',
          color: 'var(--text-muted)',
          width: '52px',
          flexShrink: 0,
          textAlign: 'right',
        }}
      >
        {label}
      </span>
      <input
        type="text"
        className="flex-1 text-xs"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: 'var(--bg)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: '5px',
          padding: '3px 7px',
          outline: 'none',
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
}

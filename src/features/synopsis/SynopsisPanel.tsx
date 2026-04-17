/**
 * あらすじパネル — 右パネル内の「あらすじ」タブ
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import { useAppStore } from '@/shared/stores/appStore';
import type { Synopsis } from '@/shared/types';

export function SynopsisPanel() {
  const projectId = useAppStore((s) => s.currentProjectId);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const loadSynopsis = useCallback(async () => {
    if (!projectId) return;
    try {
      const raw = await invoke<unknown>('get_synopsis', { projectId });
      const synopsis = raw ? toCamelCase<Synopsis>(raw) : null;
      setContent(synopsis?.content ?? '');
      setDirty(false);
    } catch { /* 無視 */ }
  }, [projectId]);

  useEffect(() => { loadSynopsis(); }, [loadSynopsis]);

  const handleSave = useCallback(async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      await invoke('save_synopsis', { projectId, content });
      setDirty(false);
    } catch { /* 無視 */ } finally {
      setSaving(false);
    }
  }, [projectId, content]);

  if (!projectId) return null;

  return (
    <div className="flex flex-col h-full p-3 gap-2">
      <div className="flex items-center justify-between flex-shrink-0">
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          あらすじ
        </span>
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="text-xs px-2 py-1 rounded"
          style={{
            background: dirty ? 'var(--accent)' : 'transparent',
            color: dirty ? '#fff' : 'var(--text-muted)',
            border: '1px solid var(--border)',
            cursor: dirty ? 'pointer' : 'default',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
      <textarea
        className="flex-1 w-full resize-none text-sm rounded p-2"
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          outline: 'none',
          fontFamily: 'inherit',
          lineHeight: '1.7',
        }}
        placeholder="物語のあらすじを入力してください..."
        value={content}
        onChange={(e) => { setContent(e.target.value); setDirty(true); }}
      />
    </div>
  );
}

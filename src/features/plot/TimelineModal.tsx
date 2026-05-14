import { useRef, useState } from 'react';
import type { Timeline } from '@/shared/types';
import { TimelineTable, type TimelineTableHandle } from './TimelineTable';

interface Props {
  projectId: string;
  timelines: Timeline[];
  onReload: () => void;
  onClose: () => void;
}

export function TimelineModal({ projectId, timelines, onReload, onClose }: Props) {
  const tableRef = useRef<TimelineTableHandle>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await tableRef.current?.flush();
    onReload();
    setSaving(false);
  };

  const handleClose = async () => {
    await handleSave();
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-light)',
          borderRadius: '12px',
          width: 'min(92vw, 1400px)',
          height: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(20, 16, 12, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* ヘッダー */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>タイムライン</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                fontSize: '12px',
                padding: '4px 12px',
                borderRadius: '6px',
                background: saving ? 'var(--bg)' : 'var(--accent)',
                color: saving ? 'var(--text-muted)' : 'var(--bg-deep)',
                border: 'none',
                cursor: saving ? 'default' : 'pointer',
                fontWeight: 500,
                transition: 'opacity 150ms',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              onClick={handleClose}
              disabled={saving}
              style={{
                background: 'none',
                border: 'none',
                cursor: saving ? 'default' : 'pointer',
                color: 'var(--text-muted)',
                fontSize: '18px',
                lineHeight: 1,
                padding: '2px 6px',
                borderRadius: '4px',
                opacity: saving ? 0.4 : 1,
              }}
              title="閉じる"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 本体 */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <TimelineTable
            ref={tableRef}
            projectId={projectId}
            timelines={timelines}
            onReload={onReload}
            isModal={true}
          />
        </div>
      </div>
    </div>
  );
}

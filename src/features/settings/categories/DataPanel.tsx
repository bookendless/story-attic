import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ProjectSettings } from '@/shared/types';
import { Row, Section, Toggle, Chips, DangerZone } from '../atoms';

interface DataPanelProps {
  draftProject: ProjectSettings;
  onProjectChange: (patch: Partial<ProjectSettings>) => void;
  currentProjectId: string | null;
}

interface StorageStats {
  dbSizeBytes: number;
  episodeBodyBytes: number;
  snapshotBytes: number;
  snapshotCount: number;
  episodeCount: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const INTERVAL_OPTIONS = [
  { value: 30,  label: '30秒' },
  { value: 60,  label: '1分' },
  { value: 180, label: '3分' },
  { value: 300, label: '5分' },
];

export function DataPanel({ draftProject, onProjectChange, currentProjectId }: DataPanelProps) {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [trimKeepCount, setTrimKeepCount] = useState(5);

  const loadStats = useCallback(async () => {
    if (!currentProjectId) return;
    setLoading(true);
    setMsg(null);
    try {
      const raw = await invoke<Record<string, unknown>>('get_storage_stats', { projectId: currentProjectId });
      setStats({
        dbSizeBytes:      raw['db_size_bytes'] as number,
        episodeBodyBytes: raw['episode_body_bytes'] as number,
        snapshotBytes:    raw['snapshot_bytes'] as number,
        snapshotCount:    raw['snapshot_count'] as number,
        episodeCount:     raw['episode_count'] as number,
      });
    } catch { /* 無視 */ } finally {
      setLoading(false);
    }
  }, [currentProjectId]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleDeleteAll = async () => {
    if (!currentProjectId) return;
    if (!window.confirm('この作品のスナップショットをすべて削除しますか？この操作は元に戻せません。')) return;
    try {
      const deleted = await invoke<number>('delete_all_snapshots', { projectId: currentProjectId });
      setMsg(`${deleted} 件のスナップショットを削除しました`);
      await loadStats();
    } catch { /* 無視 */ }
  };

  const handleTrim = async () => {
    if (!currentProjectId) return;
    try {
      const deleted = await invoke<number>('trim_snapshots', { projectId: currentProjectId, keepCount: trimKeepCount });
      setMsg(deleted > 0 ? `${deleted} 件の古いスナップショットを削除しました` : '削除対象はありませんでした');
      await loadStats();
    } catch { /* 無視 */ }
  };

  const barTotal = stats ? stats.episodeBodyBytes + stats.snapshotBytes : 0;
  const bodyPct  = barTotal > 0 ? (stats!.episodeBodyBytes / barTotal) * 100 : 0;
  const snapPct  = barTotal > 0 ? (stats!.snapshotBytes / barTotal) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 自動保存 */}
      <Section title="自動保存">
        <Row label="自動保存" desc="一定間隔で自動的に保存します">
          <Toggle
            checked={draftProject.auto_save}
            onChange={(v) => onProjectChange({ auto_save: v })}
          />
        </Row>
        <Row label="保存間隔">
          <Chips
            options={INTERVAL_OPTIONS}
            value={draftProject.auto_save_interval_sec}
            onChange={(v) => onProjectChange({ auto_save_interval_sec: v })}
            disabled={!draftProject.auto_save}
          />
        </Row>
      </Section>

      {/* ストレージ */}
      <Section title="ストレージ">
        {/* DB全体サイズ */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '10px 12px',
            borderRadius: '6px',
            background: 'var(--bg-deep)',
            border: '1px solid var(--border)',
          }}
        >
          <span style={{ fontSize: '13px', color: 'var(--text-mid)' }}>データベース全体</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
            {stats ? formatBytes(stats.dbSizeBytes) : '—'}
          </span>
        </div>

        {/* 積み上げバー */}
        {loading && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>読み込み中…</span>}
        {stats && !loading && barTotal > 0 && (
          <div>
            <div
              style={{
                display: 'flex',
                borderRadius: '4px',
                overflow: 'hidden',
                height: '8px',
                background: 'var(--bg-deep)',
                gap: '1px',
                marginBottom: '8px',
              }}
            >
              <div style={{ width: `${bodyPct}%`, background: 'var(--accent)', transition: 'width 0.4s' }} />
              <div style={{ width: `${snapPct}%`, background: 'var(--warning)', transition: 'width 0.4s' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-mid)' }}>本文データ（{stats.episodeCount} 話）</span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text)' }}>{formatBytes(stats.episodeBodyBytes)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--warning)', flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-mid)' }}>スナップショット（{stats.snapshotCount} 件）</span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text)' }}>{formatBytes(stats.snapshotBytes)}</span>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'flex-end' }}
          onClick={loadStats}
          disabled={loading}
        >
          ↻ 更新
        </button>

        {/* スナップショット整理 */}
        <div
          style={{
            padding: '12px',
            borderRadius: '6px',
            background: 'var(--bg-deep)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-mid)' }}>各エピソードの最新 N 件だけ残す</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>保持件数</span>
            <select
              className="input text-xs"
              style={{ width: '80px', padding: '3px 6px' }}
              value={trimKeepCount}
              onChange={(e) => setTrimKeepCount(Number(e.target.value))}
            >
              {[1, 2, 3, 5, 7].map((n) => (
                <option key={n} value={n}>{n} 件</option>
              ))}
            </select>
            <button className="btn btn-ghost text-xs px-3 py-1" type="button" onClick={handleTrim}>
              整理する
            </button>
          </div>
        </div>

        {msg && <span style={{ fontSize: '12px', color: 'var(--success)' }}>{msg}</span>}
      </Section>

      {/* 危険な操作 */}
      <DangerZone title="危険な操作">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-mid)' }}>すべてのスナップショットを削除</span>
          <button
            type="button"
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              background: 'none',
              border: '1px solid var(--danger)',
              color: 'var(--danger)',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
            onClick={handleDeleteAll}
          >
            全削除
          </button>
        </div>
      </DangerZone>
    </div>
  );
}

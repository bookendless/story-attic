import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useEditorStore } from '@/shared/stores/editorStore';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import type { EpisodeSummary, InfoAsymmetryResult } from '@/shared/types';

export function InfoGapPanel() {
  const currentEpisode = useEditorStore((s) => s.currentEpisode);
  const projectId = currentEpisode?.projectId ?? '';

  const [episodes, setEpisodes] = useState<EpisodeSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [result, setResult] = useState<InfoAsymmetryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    invoke<unknown[]>('list_episodes', { projectId })
      .then((raw) => {
        const list = raw.map((r) => toCamelCase<EpisodeSummary>(r));
        setEpisodes(list);
        const target = list.find((e) => e.id === currentEpisode?.id) ?? list[list.length - 1];
        if (target) setSelectedId(target.id);
      })
      .catch(() => {});
  }, [projectId, currentEpisode?.id]);

  const handleAnalyze = () => {
    if (!selectedId || !projectId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    invoke<string>('ai_get_info_asymmetry', { projectId, episodeId: selectedId })
      .then((raw) => {
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        const parsed = JSON.parse(cleaned) as {
          reader_knows: string[];
          protagonist_knows: string[];
          hidden: string[];
          analysis_note: string;
        };
        setResult({
          readerKnows: parsed.reader_knows ?? [],
          protagonistKnows: parsed.protagonist_knows ?? [],
          hidden: parsed.hidden ?? [],
          analysisNote: parsed.analysis_note ?? '',
        });
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  if (!projectId) {
    return (
      <div className="p-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        プロジェクトを開いてください
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-3 py-2 text-xs font-medium flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-mid)', fontFamily: 'var(--font-heading)' }}
      >
        読者情報格差
      </div>

      <div className="flex flex-col gap-2 p-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>分析対象（この話まで）</div>
        <select
          className="w-full text-xs px-2 py-1 rounded"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)' }}
          value={selectedId}
          onChange={(e) => { setSelectedId(e.target.value); setResult(null); }}
        >
          {episodes.map((ep) => (
            <option key={ep.id} value={ep.id}>{ep.title || '（無題）'}</option>
          ))}
        </select>
        <button
          onClick={handleAnalyze}
          disabled={loading || !selectedId}
          className="w-full text-xs py-1.5 rounded"
          style={{
            background: loading ? 'var(--bg-surface)' : 'var(--accent)',
            color: loading ? 'var(--text-muted)' : 'var(--bg)',
            border: '1px solid var(--border)',
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? 'AI分析中...' : 'AI分析'}
        </button>
        {error && (
          <div className="text-xs" style={{ color: 'var(--danger)' }}>
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
          <InfoColumn
            icon="📖"
            label="読者が知ること"
            items={result.readerKnows}
            color="var(--accent)"
          />
          <InfoColumn
            icon="🧠"
            label="主人公が知ること"
            items={result.protagonistKnows}
            color="var(--warning)"
          />
          <InfoColumn
            icon="🔒"
            label="まだ隠れていること"
            items={result.hidden}
            color="var(--danger)"
          />
          {result.analysisNote && (
            <div
              className="text-xs p-2 rounded"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >
              {result.analysisNote}
            </div>
          )}
        </div>
      )}

      {!result && !loading && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            話を選んで「AI分析」を押すと<br />情報の非対称性を分析します
          </div>
        </div>
      )}
    </div>
  );
}

function InfoColumn({
  icon, label, items, color,
}: {
  icon: string; label: string; items: string[]; color: string;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div
        className="text-xs font-medium mb-1.5 flex items-center gap-1"
        style={{ color, fontFamily: 'var(--font-heading)' }}
      >
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <ul className="flex flex-col gap-1">
        {items.map((item, i) => (
          <li
            key={i}
            className="text-xs px-2 py-1 rounded"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

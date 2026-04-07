import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useEditorStore } from '@/shared/stores/editorStore';
import { useUIStore } from '@/shared/stores/uiStore';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import type { ProofIssue } from '@/shared/types';

/** 重要度ごとのスタイル */
const SEVERITY_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  error:   { color: 'var(--danger)',  bg: 'color-mix(in srgb, var(--danger) 15%, transparent)',  label: 'エラー' },
  warning: { color: 'var(--warning)', bg: 'color-mix(in srgb, var(--warning) 15%, transparent)', label: '警告' },
  info:    { color: 'var(--text-mid)', bg: 'var(--bg-surface)', label: '情報' },
};

export function ProofreadPanel() {
  const currentEpisode = useEditorStore((s) => s.currentEpisode);
  const { proofreadSettings, editorViewMode } = useUIStore();
  const [issues, setIssues] = useState<ProofIssue[]>([]);
  const [loading, setLoading] = useState(false);

  /** 校正を実行 */
  const runProofread = useCallback(async () => {
    if (!currentEpisode || !proofreadSettings.enabled) {
      setIssues([]);
      return;
    }
    // 有効なカテゴリのみ送信
    const enabledCategories = Object.entries(proofreadSettings.categories)
      .filter(([, v]) => v)
      .map(([k]) => k);

    setLoading(true);
    try {
      const raw = await invoke<unknown[]>('run_proofread', {
        text: currentEpisode.body,
        categories: enabledCategories,
      });
      setIssues(raw.map((r) => toCamelCase<ProofIssue>(r)));
    } catch (e) {
      console.error('校正エラー:', e);
    } finally {
      setLoading(false);
    }
  }, [currentEpisode, proofreadSettings]);

  // エピソード変更やビューモード変更時に校正を実行
  useEffect(() => {
    if (editorViewMode !== 'proofread') return;
    const timer = setTimeout(() => runProofread(), 500);
    return () => clearTimeout(timer);
  }, [editorViewMode, runProofread]);

  if (editorViewMode !== 'proofread') return null;

  // カテゴリ別にグループ化
  const grouped = issues.reduce<Record<string, ProofIssue[]>>((acc, issue) => {
    if (!acc[issue.category]) acc[issue.category] = [];
    acc[issue.category].push(issue);
    return acc;
  }, {});

  return (
    <div
      className="h-full flex flex-col"
      style={{ background: 'var(--bg)', borderLeft: '1px solid var(--border)' }}
    >
      {/* ヘッダー */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          校正結果
        </span>
        <div className="flex items-center gap-2">
          {loading ? (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>検査中...</span>
          ) : (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {issues.length} 件
            </span>
          )}
          <button
            className="btn btn-ghost text-xs"
            style={{ padding: '2px 8px' }}
            onClick={runProofread}
            disabled={loading}
          >
            再検査
          </button>
        </div>
      </div>

      {/* 結果一覧 */}
      <div className="flex-1 overflow-auto px-2 py-2">
        {issues.length === 0 && !loading && (
          <div
            className="text-sm text-center py-8"
            style={{ color: 'var(--text-muted)' }}
          >
            問題は見つかりませんでした
          </div>
        )}

        {Object.entries(grouped).map(([category, catIssues]) => (
          <div key={category} className="mb-3">
            <div
              className="text-xs font-medium px-2 py-1 mb-1"
              style={{ color: 'var(--text-muted)' }}
            >
              {category}（{catIssues.length}件）
            </div>
            {catIssues.map((issue, i) => (
              <IssueCard key={`${category}-${i}`} issue={issue} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function IssueCard({ issue }: { issue: ProofIssue }) {
  const style = SEVERITY_STYLES[issue.severity] ?? SEVERITY_STYLES.info;

  return (
    <div
      className="rounded-md p-3 mb-2 mx-1"
      style={{ background: style.bg, border: `1px solid ${style.color}30` }}
    >
      <div className="flex items-start gap-2">
        <span
          className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ background: style.color, color: 'var(--bg-deep)', fontWeight: 600 }}
        >
          {style.label}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm" style={{ color: 'var(--text)' }}>
            {issue.message}
          </p>
          {issue.suggestion && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-mid)' }}>
              提案: {issue.suggestion}
            </p>
          )}
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            位置: {issue.offset}文字目〜
          </p>
        </div>
      </div>
    </div>
  );
}

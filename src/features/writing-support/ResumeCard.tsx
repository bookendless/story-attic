/**
 * 「おかえり」再開カード
 * プロジェクトを開いた直後にアプリ起動ごとに一度だけ表示。
 * 前回の執筆情報（いつ・どのエピソード・何字）と「明日の自分へのメモ」を見せ、
 * ワンクリックで前回のエピソードの続きから再開できる。
 */

import { useState, useEffect } from 'react';
import { useAppStore } from '@/shared/stores/appStore';
import { useEditorStore } from '@/shared/stores/editorStore';
import { getResumeInfo, clearResumeNote, type ResumeInfo } from '@/shared/utils/resumeSession';

/** ISO時刻を「N分前 / N時間前 / N日前」にフォーマット */
function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return 'さっき';
  const min = Math.floor(diffMs / 60000);
  if (min < 60) return `${Math.max(1, min)}分前`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}

export function ResumeCard() {
  const projectId = useAppStore((s) => s.currentProjectId);
  const chapterTree = useEditorStore((s) => s.chapterTree);
  const currentEpisode = useEditorStore((s) => s.currentEpisode);
  const switchEpisode = useEditorStore((s) => s.switchEpisode);
  const [info, setInfo] = useState<ResumeInfo | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    // アプリ起動ごとにプロジェクト単位で一度だけ表示
    const guardKey = `story-attic-resume-shown-${projectId}`;
    try { if (sessionStorage.getItem(guardKey)) return; } catch { /* 無視 */ }
    const stored = getResumeInfo(projectId);
    if (!stored?.episodeId || !stored.savedAt) return;
    setInfo(stored);
    setVisible(true);
    // メモは一度見せたら消す（次回また古いメモが出続けないように）
    if (stored.note) clearResumeNote(projectId);
    try { sessionStorage.setItem(guardKey, '1'); } catch { /* 無視 */ }
  }, [projectId]);

  // エピソードを開いたら自動で閉じる
  useEffect(() => {
    if (currentEpisode) setVisible(false);
  }, [currentEpisode]);

  const episodeId = info?.episodeId;
  if (!visible || !episodeId) return null;

  const allEpisodes = chapterTree
    ? [...chapterTree.chapters.flatMap((c) => c.episodes), ...chapterTree.ungrouped]
    : [];
  const episode = allEpisodes.find((e) => e.id === episodeId);
  // チャプターツリーの読込完了後に対象が見つからない場合（削除済み）は表示しない
  if (chapterTree && !episode) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '48px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 130,
        width: '340px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-light)',
        borderRadius: '12px',
        padding: '16px 18px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
      }}
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', color: 'var(--accent)' }}>
          おかえりなさい
        </span>
        <button
          onClick={() => setVisible(false)}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', lineHeight: 1 }}
        >
          ✕
        </button>
      </div>

      {/* 前回の情報 */}
      <p style={{ fontSize: '11px', color: 'var(--text-mid)', lineHeight: 1.6, marginBottom: '4px' }}>
        前回: {formatRelative(info.savedAt)}
        {info.writtenChars > 0 && ` ・ +${info.writtenChars.toLocaleString()}字`}
      </p>
      {episode && (
        <p style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 500, marginBottom: '8px' }}>
          「{episode.title}」
        </p>
      )}

      {/* 前回の自分からのメモ */}
      {info.note && (
        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-mid)',
            lineHeight: 1.6,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '8px 10px',
            marginBottom: '10px',
          }}
        >
          <span style={{ color: 'var(--text-muted)', fontSize: '10px', display: 'block', marginBottom: '2px' }}>
            前回の自分からのメモ
          </span>
          {info.note}
        </div>
      )}

      <div className="flex gap-2">
        <button
          className="btn btn-primary"
          style={{ flex: 1, fontSize: '12px', justifyContent: 'center' }}
          onClick={() => { void switchEpisode(episodeId); }}
        >
          続きから書く
        </button>
        <button
          className="btn"
          style={{ fontSize: '12px', justifyContent: 'center' }}
          onClick={() => setVisible(false)}
        >
          あとで
        </button>
      </div>
    </div>
  );
}

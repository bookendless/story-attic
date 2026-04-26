import { useState, useEffect, useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { invoke } from '@tauri-apps/api/core';
import { useUIStore } from '@/shared/stores/uiStore';
import { useEditorStore } from '@/shared/stores/editorStore';
import { useAppStore } from '@/shared/stores/appStore';
import { IconSun, IconMoon } from '@/shared/components/Icons';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import type { ProofIssue } from '@/shared/types';

interface Props {
  editor: Editor;
}

/** ステータスバー右側の軽量トグルボタン */
function StatusBarToggle({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '26px',
        height: '22px',
        background: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'background 120ms',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)';
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}

function ProofSummaryPopup({
  proofCount,
  onClose,
  onOpenPanel,
}: {
  proofCount: number;
  onClose: () => void;
  onOpenPanel: () => void;
}) {
  return (
    <div style={{
      position: 'absolute',
      bottom: 'calc(100% + 6px)',
      left: '0',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-light)',
      borderRadius: '8px',
      padding: '14px 16px',
      width: '240px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      zIndex: 100,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
      }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>校正チェック</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', lineHeight: 1 }}
        >
          ✕
        </button>
      </div>
      {proofCount === 0 ? (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '6px 0' }}>
          <span style={{ fontSize: '16px', color: 'var(--success)' }}>✓</span>
          <span style={{ fontSize: '12px', color: 'var(--text-mid)' }}>問題は見つかりませんでした</span>
        </div>
      ) : (
        <>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: '1.5' }}>
            {proofCount}件の指摘があります
          </p>
          <button
            className="btn btn-primary"
            style={{ width: '100%', fontSize: '12px', justifyContent: 'center' }}
            onClick={onOpenPanel}
          >
            校正パネルで確認する
          </button>
        </>
      )}
    </div>
  );
}

/** 秒数を MM:SS にフォーマット */
function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function StatusBar({ editor }: Props) {
  const { settings, proofreadSettings, setEditorViewMode, editorViewMode, dismissedIssuesByEpisode } = useUIStore();
  const { timerRunning, timerRemaining, timerTotal, startTimer, stopTimer, tickTimer, dailyGoal } = useUIStore();
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const ambienceEnabled = useUIStore((s) => s.ambienceEnabled);
  const soundEnabled = useUIStore((s) => s.soundSettings.enabled);
  const toggleAmbiencePopover = useUIStore((s) => s.toggleAmbiencePopover);
  const lastAutoSavedAt = useEditorStore((s) => s.lastAutoSavedAt);
  const lastSnapshotAt = useEditorStore((s) => s.lastSnapshotAt);
  const currentEpisode = useEditorStore((s) => s.currentEpisode);
  const projectId = useAppStore((s) => s.currentProjectId);
  const [charCount, setCharCount] = useState(0);
  const [lineCount, setLineCount] = useState(0);
  const [proofCount, setProofCount] = useState<number | null>(null);
  const [showAutoSaved, setShowAutoSaved] = useState(false);
  const [showTimerPopover, setShowTimerPopover] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(25);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showProofSummary, setShowProofSummary] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const shortcutsRef = useRef<HTMLDivElement>(null);
  const proofSummaryRef = useRef<HTMLDivElement>(null);

  // エディタの更新イベントを直接サブスクライブしてリアルタイム更新
  useEffect(() => {
    const updateCounts = () => {
      const text = editor.getText();
      setCharCount(text.length);
      setLineCount(text.split('\n').length);
    };
    updateCounts();
    editor.on('update', updateCounts);
    return () => { editor.off('update', updateCounts); };
  }, [editor]);

  // 校正件数をバックグラウンドで定期チェック（debounce 2秒）
  // ProofreadPanel と同様に currentEpisode.body を使用し3種すべての結果を合算する
  const checkProofread = useCallback(async () => {
    if (!proofreadSettings.enabled || !currentEpisode) {
      setProofCount(!proofreadSettings.enabled ? null : 0);
      return;
    }
    const enabledCategories = Object.entries(proofreadSettings.categories)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const text = currentEpisode.body;

    try {
      const [rules, readability, consistency] = await Promise.all([
        invoke<unknown[]>('run_proofread', { text, categories: enabledCategories }),
        invoke<unknown[]>('run_readability', { text }),
        invoke<unknown[]>('run_consistency_check', { text }),
      ]);
      const episodeId = currentEpisode.id;
      const dismissed = dismissedIssuesByEpisode[episodeId] ?? [];
      const toKey = (i: ProofIssue) => `${i.category}-${i.offset}-${i.length}`;
      const allIssues = [
        ...rules.map((r) => toCamelCase<ProofIssue>(r)),
        ...readability.map((r) => toCamelCase<ProofIssue>(r)),
        ...consistency.map((r) => toCamelCase<ProofIssue>(r)),
      ];
      const activeCount = allIssues.filter((i) => !dismissed.includes(toKey(i))).length;
      setProofCount(activeCount);
    } catch {
      setProofCount(null);
    }
  }, [currentEpisode, proofreadSettings, dismissedIssuesByEpisode]);

  useEffect(() => {
    if (!proofreadSettings.enabled) {
      setProofCount(null);
      return;
    }
    checkProofread();
    let timer: ReturnType<typeof setTimeout>;
    const handler = () => {
      clearTimeout(timer);
      timer = setTimeout(checkProofread, 2000);
    };
    editor.on('update', handler);
    return () => {
      editor.off('update', handler);
      clearTimeout(timer);
    };
  }, [editor, proofreadSettings.enabled, checkProofread]);

  // 自動保存完了時に3秒間「自動保存済み」を表示
  useEffect(() => {
    if (!lastAutoSavedAt) return;
    setShowAutoSaved(true);
    const timer = setTimeout(() => setShowAutoSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [lastAutoSavedAt]);

  // タイマーのtick（1秒ごと）
  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      tickTimer();
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, tickTimer]);

  // タイマー終了時に日記記録
  useEffect(() => {
    if (timerTotal > 0 && !timerRunning && timerRemaining === 0) {
      // タイマーが自然終了した（totalが残っている = stopTimerではなくtickで0になった）
      const durationSec = timerTotal;
      if (projectId) {
        const today = new Date().toISOString().slice(0, 10);
        invoke('save_diary_entry', {
          projectId,
          date: today,
          charCount: currentEpisode?.charCount ?? 0,
          sessionSec: durationSec,
        }).catch(() => { /* 無視 */ });
      }
    }
  }, [timerRunning, timerRemaining, timerTotal, projectId, currentEpisode]);

  // ポップオーバー外クリックで閉じる
  useEffect(() => {
    if (!showTimerPopover) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowTimerPopover(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTimerPopover]);

  // ショートカットパネル外クリックで閉じる
  useEffect(() => {
    if (!showShortcuts) return;
    const handler = (e: MouseEvent) => {
      if (shortcutsRef.current && !shortcutsRef.current.contains(e.target as Node)) {
        setShowShortcuts(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showShortcuts]);

  // 校正サマリーポップアップ外クリックで閉じる
  useEffect(() => {
    if (!showProofSummary) return;
    const handler = (e: MouseEvent) => {
      if (proofSummaryRef.current && !proofSummaryRef.current.contains(e.target as Node)) {
        setShowProofSummary(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showProofSummary]);

  const handleTimerClick = () => {
    if (timerRunning) {
      // 動作中はクリックで停止
      const elapsed = timerTotal - timerRemaining;
      if (elapsed > 10 && projectId) {
        const today = new Date().toISOString().slice(0, 10);
        invoke('save_diary_entry', {
          projectId,
          date: today,
          charCount: currentEpisode?.charCount ?? 0,
          sessionSec: elapsed,
        }).catch(() => { /* 無視 */ });
      }
      stopTimer();
    } else {
      startTimer(timerMinutes);
    }
  };

  const handleTimerContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!timerRunning) {
      setShowTimerPopover((v) => !v);
    }
  };

  // 原稿換算ページ数
  const charsPerPage = settings.chars_per_line * settings.lines_per_page;
  const pageCount = charsPerPage > 0 ? Math.ceil(charCount / charsPerPage) : 0;

  return (
    <div
      className="flex items-center flex-shrink-0 border-t text-xs"
      style={{
        background: 'var(--bg-deep)',
        borderColor: 'var(--border)',
        color: 'var(--text-muted)',
        height: '32px',
      }}
    >
      {/* 左側: 文字数・行数・ページ数・自動保存・校正 */}
      <div className="flex items-center gap-4 px-4 flex-1 min-w-0">
        <span>{charCount.toLocaleString()} 字</span>
        <span>{lineCount.toLocaleString()} 行</span>
        <span>{pageCount} P</span>
        {showAutoSaved && (
          <span
            style={{
              color: 'var(--success)',
              transition: 'opacity 300ms',
            }}
          >
            自動保存済み
          </span>
        )}
        {lastSnapshotAt && (
          <span
            title={`最終スナップショット: ${new Date(lastSnapshotAt).toLocaleString('ja-JP')}`}
            style={{ color: 'var(--text-muted)' }}
          >
            履歴 {new Date(lastSnapshotAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {proofCount !== null && (
          <div style={{ position: 'relative' }} ref={proofSummaryRef}>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '11px',
                transition: 'background 120ms',
                color: proofCount === 0
                  ? 'var(--success)'
                  : proofCount <= 3
                  ? 'var(--warning)'
                  : 'var(--danger)',
              }}
              onClick={() => setShowProofSummary((v) => !v)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
              title="校正チェック結果"
            >
              <span style={{ fontSize: '12px' }}>{proofCount === 0 ? '✓' : '✎'}</span>
              <span>{proofCount === 0 ? '校正OK' : `校正 ${proofCount}件`}</span>
            </button>
            {showProofSummary && (
              <ProofSummaryPopup
                proofCount={proofCount}
                onClose={() => setShowProofSummary(false)}
                onOpenPanel={() => {
                  setEditorViewMode(editorViewMode === 'proofread' ? 'editor' : 'proofread');
                  setShowProofSummary(false);
                }}
              />
            )}
          </div>
        )}
        {dailyGoal && dailyGoal > 0 && (
          <div className="flex items-center gap-1.5" style={{ minWidth: '100px', maxWidth: '160px' }}>
            <div
              style={{
                flex: 1,
                height: '6px',
                background: 'var(--bg)',
                borderRadius: '3px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, Math.round((charCount / dailyGoal) * 100))}%`,
                  background: charCount >= dailyGoal ? 'var(--success)' : 'var(--accent)',
                  borderRadius: '3px',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <span style={{ color: charCount >= dailyGoal ? 'var(--success)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {Math.min(100, Math.round((charCount / dailyGoal) * 100))}%
            </span>
          </div>
        )}
      </div>

      {/* 右側: トグル群 + タイマー */}
      <div className="flex items-center gap-1 px-2 relative" style={{ flexShrink: 0 }}>
        {/* 雰囲気ポップオーバー起動 (演出/サウンド/ゴースト) */}
        <StatusBarToggle
          active={ambienceEnabled || soundEnabled}
          onClick={toggleAmbiencePopover}
          title="雰囲気設定 (演出/サウンド/ゴースト)"
        >
          <span style={{ fontSize: '13px' }}>♪</span>
        </StatusBarToggle>

        {/* テーマ切替 */}
        <StatusBarToggle
          active={false}
          onClick={toggleTheme}
          title={theme === 'dark' ? 'ライトモードへ' : 'ダークモードへ'}
        >
          {theme === 'dark' ? <IconSun size={14} /> : <IconMoon size={14} />}
        </StatusBarToggle>

        {/* ショートカット一覧 */}
        <StatusBarToggle
          active={showShortcuts}
          onClick={() => setShowShortcuts((v) => !v)}
          title="ショートカット一覧"
        >
          <span style={{ fontSize: '11px', fontWeight: 600 }}>?</span>
        </StatusBarToggle>

        {/* ショートカットパネル */}
        {showShortcuts && (
          <div
            ref={shortcutsRef}
            style={{
              position: 'absolute',
              bottom: '100%',
              right: '8px',
              marginBottom: '4px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
              padding: '16px 20px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              zIndex: 100,
              width: '380px',
            }}
          >
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', color: 'var(--accent)', marginBottom: '12px' }}>
              キーボードショートカット
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
              {[
                {
                  label: 'ファイル操作',
                  items: [
                    { name: '保存', keys: ['Ctrl', 'S'] },
                    { name: 'コマンドパレット', keys: ['Ctrl', 'P'] },
                  ],
                },
                {
                  label: 'ビューモード',
                  items: [
                    { name: 'デュアルビュー', keys: ['Ctrl', 'Shift', 'D'] },
                    { name: 'プレビュー', keys: ['Ctrl', 'Shift', 'P'] },
                    { name: '台詞ビュー', keys: ['Ctrl', 'Shift', 'L'] },
                  ],
                },
                {
                  label: 'パネル切替',
                  items: [
                    { name: '目次', keys: ['Ctrl', '1'] },
                    { name: '章立て', keys: ['Ctrl', '2'] },
                    { name: '人物', keys: ['Ctrl', '3'] },
                    { name: 'プロット', keys: ['Ctrl', '4'] },
                    { name: 'あらすじ', keys: ['Ctrl', '5'] },
                    { name: '相関図', keys: ['Ctrl', '6'] },
                    { name: '用語', keys: ['Ctrl', '7'] },
                    { name: '世界観', keys: ['Ctrl', '8'] },
                    { name: '伏線', keys: ['Ctrl', '9'] },
                    { name: 'メモ', keys: ['Ctrl', '0'] },
                    { name: 'パネル開閉', keys: ['Ctrl', 'Shift', 'R'] },
                  ],
                },
                {
                  label: 'AI・支援',
                  items: [
                    { name: 'AIアシスタント', keys: ['Ctrl', 'Shift', 'A'] },
                    { name: 'タイマー開始/停止', keys: ['Ctrl', 'T'] },
                  ],
                },
              ].map((group) => (
                <div key={group.label} style={{ marginBottom: '12px' }}>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '6px', textTransform: 'uppercase' }}>
                    {group.label}
                  </p>
                  {group.items.map((item) => (
                    <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-mid)' }}>{item.name}</span>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        {item.keys.map((k, i) => (
                          <span
                            key={i}
                            style={{
                              background: 'var(--bg-deep)',
                              border: '1px solid var(--border-light)',
                              borderRadius: '4px',
                              padding: '0 5px',
                              height: '20px',
                              fontSize: '10px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              color: 'var(--text-mid)',
                            }}
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="w-px h-4 mx-1" style={{ background: 'var(--border)' }} />

        <button
          className="flex items-center gap-1 hover:opacity-80 transition-opacity"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: timerRunning
              ? (timerRemaining <= 60 ? 'var(--danger)' : 'var(--accent)')
              : 'var(--text-muted)',
            fontSize: '12px',
            fontFamily: timerRunning ? 'var(--font-heading)' : 'inherit',
          }}
          onClick={handleTimerClick}
          onContextMenu={handleTimerContextMenu}
          title={timerRunning ? 'クリックで停止' : '右クリックで時間設定'}
        >
          <span style={{ fontSize: '13px' }}>&#9201;</span>
          {timerRunning ? (
            <span className="font-mono" style={{ minWidth: '42px', textAlign: 'center' }}>
              {formatTime(timerRemaining)}
            </span>
          ) : (
            <span>開始</span>
          )}
        </button>

        {/* 時間設定ポップオーバー */}
        {showTimerPopover && (
          <div
            ref={popoverRef}
            style={{
              position: 'absolute',
              bottom: '100%',
              right: '8px',
              marginBottom: '4px',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '8px 12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              zIndex: 100,
            }}
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="text-xs bg-transparent outline-none"
                style={{
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  width: '50px',
                }}
                value={timerMinutes}
                onChange={(e) => setTimerMinutes(Math.max(1, Math.min(180, Number(e.target.value) || 1)))}
                min={1}
                max={180}
              />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>分</span>
              <button
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  background: 'var(--accent)',
                  color: 'var(--bg-deep)',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  startTimer(timerMinutes);
                  setShowTimerPopover(false);
                }}
              >
                開始
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

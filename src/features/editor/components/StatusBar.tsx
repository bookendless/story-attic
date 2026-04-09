import { useState, useEffect, useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { invoke } from '@tauri-apps/api/core';
import { useUIStore } from '@/shared/stores/uiStore';
import { useEditorStore } from '@/shared/stores/editorStore';
import { useAppStore } from '@/shared/stores/appStore';

interface Props {
  editor: Editor;
}

/** 秒数を MM:SS にフォーマット */
function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function StatusBar({ editor }: Props) {
  const { settings, proofreadSettings, setEditorViewMode, editorViewMode } = useUIStore();
  const { timerRunning, timerRemaining, timerTotal, startTimer, stopTimer, tickTimer, dailyGoal } = useUIStore();
  const lastAutoSavedAt = useEditorStore((s) => s.lastAutoSavedAt);
  const currentEpisode = useEditorStore((s) => s.currentEpisode);
  const projectId = useAppStore((s) => s.currentProjectId);
  const [charCount, setCharCount] = useState(0);
  const [lineCount, setLineCount] = useState(0);
  const [proofCount, setProofCount] = useState<number | null>(null);
  const [showAutoSaved, setShowAutoSaved] = useState(false);
  const [showTimerPopover, setShowTimerPopover] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(25);
  const popoverRef = useRef<HTMLDivElement>(null);

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
  const checkProofread = useCallback(() => {
    if (!proofreadSettings.enabled) {
      setProofCount(null);
      return;
    }
    const enabledCategories = Object.entries(proofreadSettings.categories)
      .filter(([, v]) => v)
      .map(([k]) => k);

    invoke<unknown[]>('run_proofread', {
      text: editor.getHTML(),
      categories: enabledCategories,
    })
      .then((result) => setProofCount(result.length))
      .catch(() => setProofCount(null));
  }, [editor, proofreadSettings]);

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
        {proofCount !== null && proofCount > 0 && (
          <button
            className="hover:opacity-80 transition-opacity"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--warning)',
              fontSize: '12px',
            }}
            onClick={() => setEditorViewMode(editorViewMode === 'proofread' ? 'editor' : 'proofread')}
            title="校正パネルを開く"
          >
            校正: {proofCount}件
          </button>
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

      {/* 右側: タイマー */}
      <div className="flex items-center gap-2 px-4 relative" style={{ flexShrink: 0 }}>
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

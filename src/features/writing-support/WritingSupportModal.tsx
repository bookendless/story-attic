/**
 * 執筆支援モーダル — 目標設定・タイマー・履歴・日記カレンダーを統合
 */

import { useUIStore } from '@/shared/stores/uiStore';
import { useAppStore } from '@/shared/stores/appStore';
import { useEditorStore } from '@/shared/stores/editorStore';
import { GoalSetting } from './GoalSetting';
import { WritingTimer } from './WritingTimer';
import { HistoryViewer } from './HistoryViewer';
import { DiaryCalendar } from './DiaryCalendar';

export function WritingSupportModal() {
  const { writingSupportModalVisible, toggleWritingSupportModal } = useUIStore();
  const projectId = useAppStore((s) => s.currentProjectId);
  const { currentEpisode } = useEditorStore();

  const currentCharCount = currentEpisode?.charCount ?? 0;

  if (!writingSupportModalVisible) return null;

  return (
    <div className="modal-overlay" onClick={toggleWritingSupportModal}>
      <div
        className="modal-box"
        style={{ maxWidth: '520px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-base font-medium"
            style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}
          >
            執筆支援
          </h2>
          <button
            className="text-xs"
            style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={toggleWritingSupportModal}
          >
            ✕
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-6 pr-1">
          <GoalSetting currentCharCount={currentCharCount} />

          <div style={{ borderTop: '1px solid var(--border)' }} />

          <WritingTimer />

          <div style={{ borderTop: '1px solid var(--border)' }} />

          <HistoryViewer episodeId={currentEpisode?.id ?? null} />

          <div style={{ borderTop: '1px solid var(--border)' }} />

          <DiaryCalendar projectId={projectId} />
        </div>
      </div>
    </div>
  );
}

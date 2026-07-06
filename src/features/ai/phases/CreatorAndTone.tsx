/**
 * CreatorAndTone — 作家タイプ × 口調セクションの中身（全フェーズ共通）
 */
import { useAiStore } from '@/shared/stores/aiStore';
import { useAppStore } from '@/shared/stores/appStore';
import type { CreatorType } from '@/shared/types';
import { Chip } from '../atoms/Chip';

export function CreatorAndTone({ accent }: { accent: string }) {
  const creatorType = useAiStore((s) => s.creatorType);
  const tone = useAiStore((s) => s.tone);
  const setTone = useAiStore((s) => s.setTone);
  const saveCreatorType = useAiStore((s) => s.saveCreatorType);
  const currentProjectId = useAppStore((s) => s.currentProjectId);

  const changeType = (type: CreatorType) => {
    if (currentProjectId) void saveCreatorType(currentProjectId, type);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '4px 4px 6px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>作家タイプ</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <Chip size="sm" active={creatorType === 'explorer'} accent={accent} onClick={() => changeType('explorer')}>
            Explorer
          </Chip>
          <Chip size="sm" active={creatorType === 'architect'} accent={accent} onClick={() => changeType('architect')}>
            Architect
          </Chip>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>口調</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <Chip size="sm" active={tone === 'formal'} accent={accent} onClick={() => setTone('formal')}>丁寧</Chip>
          <Chip size="sm" active={tone === 'casual'} accent={accent} onClick={() => setTone('casual')}>カジュアル</Chip>
          <Chip size="sm" active={tone === 'harsh'} accent={accent} onClick={() => setTone('harsh')}>辛口</Chip>
        </div>
      </div>
    </div>
  );
}

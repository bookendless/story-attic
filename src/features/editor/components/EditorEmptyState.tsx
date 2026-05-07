import { useState } from 'react';
import { useUIStore } from '@/shared/stores/uiStore';
import { useEditorStore } from '@/shared/stores/editorStore';
import { useAppStore } from '@/shared/stores/appStore';

const STEPS = [
  {
    icon: '☰',
    label: '目次タブを開く',
    desc: 'サイドパネル「目次」から章・話を管理できます',
    shortcut: 'Ctrl+1',
    hint: 'ダブルクリックで開く',
  },
  {
    icon: '＋',
    label: '新しい話を追加',
    desc: '＋ボタンで最初の話を作成してみましょう',
    shortcut: null,
    hint: 'ダブルクリックで追加',
  },
  {
    icon: '✦',
    label: 'AI相談から開始',
    desc: 'AIアシスタントと話すことでプロット・あらすじのヒントを得られます',
    shortcut: 'Ctrl+Shift+A',
    hint: null,
  },
];

export function EditorEmptyState() {
  const toggleAiPanel = useUIStore((s) => s.toggleAiPanel);
  const openSidePanelTab = useUIStore((s) => s.openSidePanelTab);
  const [activeStep, setActiveStep] = useState<number | null>(null);

  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const { createEpisode, switchEpisode, chapterTree } = useEditorStore();

  const handleStepDoubleClick = async (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    if (index === 0) {
      openSidePanelTab('toc');
    } else if (index === 1) {
      if (!currentProjectId) return;
      openSidePanelTab('toc');
      const allEpisodes = [
        ...(chapterTree?.chapters.flatMap((c) => c.episodes) ?? []),
        ...(chapterTree?.ungrouped ?? []),
      ];
      const id = await createEpisode(currentProjectId, `第${allEpisodes.length + 1}話`);
      await switchEpisode(id);
    }
  };

  return (
    <div className="h-full flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: '360px', padding: '0 16px' }}>
        {/* 上部: アイコン + 見出し + サブテキスト */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px', color: 'var(--accent)' }}>✦</div>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', color: 'var(--text)', marginBottom: '6px' }}>
            物語を始めよう
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            以下の手順で執筆を始めます
          </p>
        </div>

        {/* 中部: ステップカード */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
          {STEPS.map((step, i) => {
            const isActive = activeStep === i;
            return (
              <button
                key={i}
                onClick={() => setActiveStep(isActive ? null : i)}
                onDoubleClick={(e) => handleStepDoubleClick(e, i)}
                title={step.hint ?? undefined}
                style={{
                  width: '100%',
                  background: isActive ? 'var(--accent-soft)' : 'var(--bg-surface)',
                  border: `1px solid ${isActive ? 'rgba(196,149,106,0.4)' : 'var(--border)'}`,
                  borderRadius: '8px',
                  padding: '10px 14px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 120ms, border-color 120ms',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px', flexShrink: 0, color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {step.icon}
                  </span>
                  <span style={{ flex: 1, fontSize: '13px', color: isActive ? 'var(--accent)' : 'var(--text)', fontFamily: 'var(--font-ui)' }}>
                    {step.label}
                  </span>
                  {step.shortcut && (
                    <span style={{
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      flexShrink: 0,
                    }}>
                      {step.shortcut}
                    </span>
                  )}
                  {step.hint && (
                    <span style={{
                      fontSize: '9px',
                      color: 'var(--text-muted)',
                      opacity: 0.65,
                      flexShrink: 0,
                    }}>
                      {step.hint}
                    </span>
                  )}
                </div>
                {isActive && (
                  <p style={{ fontSize: '11px', color: 'var(--text-mid)', marginTop: '6px', lineHeight: 1.6, paddingLeft: '30px' }}>
                    {step.desc}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* 下部: AIボタン */}
        <div style={{ textAlign: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={toggleAiPanel}
            style={{ width: '100%' }}
          >
            AI相談から開始
          </button>
        </div>
      </div>
    </div>
  );
}

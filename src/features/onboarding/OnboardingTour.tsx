import { useState, useEffect, useCallback } from 'react';

interface TourStep {
  id: string;
  title: string;
  description: string;
  highlight: string | null;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'StoryAtticへようこそ ✦',
    description: 'あなただけの物語を紡ぐ場所です。\n簡単なツアーで主要機能をご紹介します。',
    highlight: null,
  },
  {
    id: 'sidebar',
    title: 'サイドパネル — 物語の設計図',
    description: '10種類のパネルでキャラクター・プロット・世界観などを管理。\nCtrl+1〜0 でタブを素早く切り替えられます。',
    highlight: 'activity-bar',
  },
  {
    id: 'viewmode',
    title: 'ビューモード切替',
    description: 'エディタ / 台詞 / プレビュー / デュアルの4モードを使い分けて執筆できます。',
    highlight: 'view-mode-segmented',
  },
  {
    id: 'ai',
    title: 'AIアシスタント',
    description: 'Ctrl+Shift+Aで起動。構成案の生成・台詞提案・文章校正など幅広くサポートします。',
    highlight: 'ai-button',
  },
  {
    id: 'command',
    title: 'コマンドパレット',
    description: 'Ctrl+Pで全機能へアクセス。文章分析・執筆支援・設定などをキーボードから呼び出せます。',
    highlight: 'command-palette-button',
  },
];

const STORAGE_KEY = 'storyattic_tour_completed';

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function OnboardingTour() {
  const [active, setActive] = useState(() => localStorage.getItem(STORAGE_KEY) !== 'true');
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<HighlightRect | null>(null);

  const currentStep = TOUR_STEPS[step];

  const updateRect = useCallback(() => {
    if (!currentStep.highlight) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${currentStep.highlight}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    } else {
      setRect(null);
    }
  }, [currentStep.highlight]);

  useEffect(() => {
    if (!active) return;
    updateRect();
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, [active, updateRect]);

  const complete = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setActive(false);
  };

  const next = () => {
    if (step < TOUR_STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      complete();
    }
  };

  const prev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  if (!active) return null;

  // ダイアログの位置を決定
  const dialogStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 201,
    width: '340px',
    background: 'var(--bg-elevated)',
    border: '1px solid rgba(196,149,106,0.35)',
    borderRadius: '12px',
    padding: '24px 28px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  };

  if (rect) {
    const gap = 12;
    const dialogW = 340;
    const dialogH = 240;
    const spaceRight = window.innerWidth - (rect.left + rect.width);
    const spaceLeft = rect.left;
    const spaceBelow = window.innerHeight - (rect.top + rect.height);

    if (spaceRight >= dialogW + gap) {
      // 要素の右側に配置
      dialogStyle.left = rect.left + rect.width + gap;
      dialogStyle.top = Math.max(16, Math.min(rect.top, window.innerHeight - dialogH - 16));
    } else if (spaceLeft >= dialogW + gap) {
      // 要素の左側に配置
      dialogStyle.right = window.innerWidth - rect.left + gap;
      dialogStyle.top = Math.max(16, Math.min(rect.top, window.innerHeight - dialogH - 16));
    } else if (spaceBelow >= dialogH) {
      // 要素の下に配置
      dialogStyle.top = rect.top + rect.height + gap;
      dialogStyle.left = Math.min(Math.max(16, rect.left), window.innerWidth - dialogW - 16);
    } else {
      // 要素の上に配置
      dialogStyle.bottom = window.innerHeight - rect.top + gap;
      dialogStyle.left = Math.min(Math.max(16, rect.left), window.innerWidth - dialogW - 16);
    }
  } else {
    dialogStyle.top = '50%';
    dialogStyle.left = '50%';
    dialogStyle.transform = 'translate(-50%, -50%)';
  }

  return (
    <>
      {/* ダークオーバーレイ */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 199,
          background: rect ? 'transparent' : 'rgba(20,16,12,0.80)',
          pointerEvents: rect ? 'none' : 'auto',
        }}
        onClick={rect ? undefined : complete}
      />

      {/* スポットライト（ハイライト要素の上に重ねてbox-shadowで穴を作る） */}
      {rect && (
        <div
          style={{
            position: 'fixed',
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            borderRadius: '6px',
            boxShadow: '0 0 0 9999px rgba(20,16,12,0.80)',
            zIndex: 200,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* ダイアログカード */}
      <div style={dialogStyle}>
        {/* プログレスバー */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: '3px',
                borderRadius: '2px',
                background: i <= step ? 'var(--accent)' : 'var(--border)',
                transition: 'background 200ms',
              }}
            />
          ))}
        </div>

        {/* タイトル */}
        <p style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '15px',
          color: 'var(--text)',
          marginBottom: '10px',
        }}>
          {currentStep.title}
        </p>

        {/* 説明文 */}
        <p style={{
          fontSize: '12px',
          color: 'var(--text-mid)',
          lineHeight: 1.8,
          whiteSpace: 'pre-line',
          marginBottom: '20px',
        }}>
          {currentStep.description}
        </p>

        {/* ボタン行 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn btn-ghost"
            style={{ fontSize: '11px', padding: '4px 10px' }}
            onClick={complete}
          >
            スキップ
          </button>
          <div style={{ flex: 1 }} />
          {step > 0 && (
            <button
              className="btn btn-ghost"
              style={{ fontSize: '11px', padding: '4px 10px' }}
              onClick={prev}
            >
              ← 戻る
            </button>
          )}
          <button
            className="btn btn-primary"
            style={{ fontSize: '11px', padding: '4px 14px' }}
            onClick={next}
          >
            {step === TOUR_STEPS.length - 1 ? '完了 ✓' : '次へ →'}
          </button>
        </div>
      </div>
    </>
  );
}

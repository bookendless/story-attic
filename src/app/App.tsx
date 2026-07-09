import { useEffect } from 'react';
import { useAppStore } from '@/shared/stores/appStore';
import { useUIStore } from '@/shared/stores/uiStore';
import { HomePage } from '@/features/project/HomePage';
import { WorkspacePage } from '@/features/editor/WorkspacePage';
import { OnboardingTour } from '@/features/onboarding/OnboardingTour';
import { ToastContainer } from '@/shared/components/Toast';

export function App() {
  const currentView = useAppStore((s) => s.currentView);
  const theme = useUIStore((s) => s.theme);

  // テーマ変更時にdocumentElementへdata-theme属性を同期
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // OS/WebView既定の右クリックメニューをアプリ全体で抑制する。
  // 編集領域では contentEditable 上で WebView2 既定メニューが preventDefault より優先して
  // 出現することがあり、自前メニューの初回クリックが「既定メニューを閉じるだけ」になってしまう。
  // capture フェーズで最優先に preventDefault することで既定メニューの出現自体を防ぐ。
  useEffect(() => {
    const handler = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handler, true);
    return () => document.removeEventListener('contextmenu', handler, true);
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      {currentView === 'home' ? <HomePage /> : <WorkspacePage />}
      {currentView === 'workspace' && <OnboardingTour />}
      <ToastContainer />
    </div>
  );
}

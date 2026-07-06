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

  return (
    <div className="h-screen w-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      {currentView === 'home' ? <HomePage /> : <WorkspacePage />}
      {currentView === 'workspace' && <OnboardingTour />}
      <ToastContainer />
    </div>
  );
}

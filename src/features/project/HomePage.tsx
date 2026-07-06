import { useEffect, useState } from 'react';
import { useProjectStore } from '@/shared/stores/projectStore';
import { useAppStore } from '@/shared/stores/appStore';
import { useUIStore } from '@/shared/stores/uiStore';
import { ProjectCard } from './ProjectCard';
import { NewProjectCard } from './NewProjectCard';
import { ImportExportButtons } from './ImportExportButtons';
import { IconSun, IconMoon } from '@/shared/components/Icons';
import type { ProjectSummary } from '@/shared/types';

export function HomePage() {
  const { projects, isLoading, loadProjects, deleteProject } = useProjectStore();
  const navigateTo = useAppStore((s) => s.navigateTo);
  const { theme, toggleTheme } = useUIStore();
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);
  const [showWelcome, setShowWelcome] = useState<boolean>(
    () => localStorage.getItem('storyattic_welcome_dismissed') !== 'true',
  );
  const [showAiDialog, setShowAiDialog] = useState(false);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const handleOpen = (id: string) => {
    navigateTo('workspace', id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteProject(deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleDismissWelcome = () => {
    localStorage.setItem('storyattic_welcome_dismissed', 'true');
    setShowWelcome(false);
  };

  const hasProjects = projects.length > 0;

  return (
    <div
      className="flex flex-col h-full ambient-noise ambient-lamp-glow page-enter"
      style={{ background: 'var(--bg)', position: 'relative' }}
    >
      {/* ヘッダー */}
      <header
        className="relative flex items-center justify-between px-10 py-6 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="header-glow-line" />
        <div className="flex flex-col">
          <h1
            className="text-3xl font-medium tracking-[0.2em] select-none title-glow"
            style={{ fontFamily: 'var(--font-app-title)', color: 'var(--accent)' }}
          >
            StoryAttic
          </h1>
          <p
            className="text-xs mt-1 tracking-widest"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}
          >
            あなただけの物語が眠る場所
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportExportButtons
            onImported={loadProjects}
            onAiImported={(id) => navigateTo('workspace', id)}
            showAiDialog={showAiDialog}
            setShowAiDialog={setShowAiDialog}
          />
          <button
            className="header-icon-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'ライトモードに切替' : 'ダークモードに切替'}
          >
            {theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
          </button>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-y-auto relative z-[1]">
        {/* ウェルカムバナー */}
        {showWelcome && (
          <div style={{
            margin: '24px 40px 0',
            borderRadius: '10px',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, var(--bg-elevated) 0%, rgba(196,149,106,0.06) 100%)',
            border: '1px solid rgba(196,149,106,0.3)',
          }}>
            <div style={{ padding: '18px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', color: 'var(--text)' }}>
                  StoryAtticへようこそ ✦
                </div>
                <button
                  onClick={handleDismissWelcome}
                  className="header-icon-btn"
                  style={{ width: 24, height: 24, minWidth: 24 }}
                >
                  ✕
                </button>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-mid)', lineHeight: 1.8, marginBottom: '14px' }}>
                「新規作成」で一から始めるか、
                <strong style={{ color: 'var(--accent)' }}>AIインポート</strong>で
                テキスト・設定ファイルから物語の骨格を自動生成できます。
                まずはどちらかを試してみましょう。
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-primary" onClick={() => setShowAiDialog(true)}>
                  AIインポートを試す
                </button>
                <button className="btn btn-ghost" onClick={handleDismissWelcome}>
                  あとで見る
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div
              className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
            />
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              読み込み中...
            </span>
          </div>
        ) : (
          <div className="px-10 py-8">
            {/* 作品セクション見出し */}
            {hasProjects && (
              <div className="mb-6 flex items-center gap-4">
                <h2
                  className="text-sm tracking-wider flex-shrink-0"
                  style={{
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-heading)',
                  }}
                >
                  あなたの作品
                </h2>
                <div
                  className="flex-1 h-px"
                  style={{
                    background: 'linear-gradient(90deg, var(--border), transparent)',
                  }}
                />
              </div>
            )}

            <div
              className="grid gap-5"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              }}
            >
              <NewProjectCard onCreated={(id) => handleOpen(id)} />
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpen={() => handleOpen(project.id)}
                  onDelete={() => setDeleteTarget(project)}
                />
              ))}
            </div>

            {/* 作品がないときの詩的なメッセージ */}
            {!hasProjects && (
              <div
                className="flex flex-col items-center text-center mt-12 mb-8"
                style={{ animation: 'fadeIn 800ms ease-out' }}
              >
                <div className="separator-ornament w-48 mb-6">
                  <span style={{ color: 'var(--accent)', fontSize: '14px' }}>✦</span>
                </div>
                <p
                  className="text-base leading-loose mb-2"
                  style={{
                    color: 'var(--text-mid)',
                    fontFamily: 'var(--font-heading)',
                  }}
                >
                  まだ物語はありません
                </p>
                <p
                  className="text-sm leading-relaxed max-w-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  ランプの灯りのもとで、あなたの最初の物語を始めてみませんか
                </p>
                <div className="separator-ornament w-48 mt-6">
                  <span style={{ color: 'var(--accent)', fontSize: '14px' }}>✦</span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* フッター */}
      <footer
        className="flex items-center justify-center py-3 border-t"
        style={{ borderColor: 'var(--border)' }}
      >
        <span
          className="text-xs tracking-wider"
          style={{
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-heading)',
            opacity: 0.5,
          }}
        >
          物語は、いつもここにある
        </span>
      </footer>

      {/* 削除確認ダイアログ */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-medium mb-3" style={{ color: 'var(--text)' }}>
              作品を削除しますか？
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-mid)' }}>
              「<strong style={{ color: 'var(--text)' }}>{deleteTarget.title}</strong>」を削除します。
              この操作は取り消せません。
            </p>
            <div className="flex justify-end gap-3">
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>
                キャンセル
              </button>
              <button className="btn btn-danger" onClick={handleDeleteConfirm}>
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile, writeFile } from '@tauri-apps/plugin-fs';
import { useAppStore } from '@/shared/stores/appStore';
import { useEditorStore } from '@/shared/stores/editorStore';
import { useProjectStore } from '@/shared/stores/projectStore';
import { IconExport } from '@/shared/components/Icons';

/** ファイル名に使えない文字を全角に置換 */
function sanitize(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, (ch) => {
    const map: Record<string, string> = {
      '\\': '＼', '/': '／', ':': '：', '*': '＊',
      '?': '？', '"': '＂', '<': '＜', '>': '＞', '|': '｜',
    };
    return map[ch] ?? ch;
  });
}

/** 「タイトル_YYYYMMDD_HHmmss」形式のファイル名ベースを生成 */
function buildBaseName(title: string): string {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const time = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  return `${sanitize(title)}_${date}_${time}`;
}

export function ExportMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const { chapterTree } = useEditorStore();
  const projectTitle = useProjectStore((s) => s.currentProject?.title ?? '無題');

  const handleExportJson = async () => {
    if (!currentProjectId) return;
    const json = await invoke<string>('export_project_json', { projectId: currentProjectId });
    const filePath = await save({
      filters: [{ name: 'StoryAttic', extensions: ['json'] }],
      defaultPath: `${buildBaseName(projectTitle)}.story-attic.json`,
    });
    if (filePath) {
      await writeTextFile(filePath, json);
    }
    setIsOpen(false);
  };

  const handleExportTxt = async () => {
    if (!currentProjectId || !chapterTree) return;
    // 全エピソードIDを収集
    const allIds = [
      ...chapterTree.chapters.flatMap((c) => c.episodes.map((e) => e.id)),
      ...chapterTree.ungrouped.map((e) => e.id),
    ];
    const text = await invoke<string>('export_episodes_txt', {
      projectId: currentProjectId,
      episodeIds: allIds,
    });
    const filePath = await save({
      filters: [{ name: 'テキスト', extensions: ['txt'] }],
      defaultPath: `${buildBaseName(projectTitle)}.txt`,
    });
    if (filePath) {
      await writeTextFile(filePath, text);
    }
    setIsOpen(false);
  };

  const handleExportZip = async () => {
    if (!currentProjectId) return;
    const hex = await invoke<string>('export_episodes_zip', { projectId: currentProjectId });
    // HEXをバイナリに変換
    const bytes = new Uint8Array(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
    const filePath = await save({
      filters: [{ name: 'ZIP', extensions: ['zip'] }],
      defaultPath: `${buildBaseName(projectTitle)}.zip`,
    });
    if (filePath) {
      await writeFile(filePath, bytes);
    }
    setIsOpen(false);
  };

  const handleImportTxt = async () => {
    if (!currentProjectId) return;
    const paths = await open({
      multiple: true,
      filters: [{ name: 'テキスト', extensions: ['txt'] }],
    });
    if (!paths || (paths as string[]).length === 0) return;

    const files = await Promise.all(
      (paths as string[]).map(async (p) => {
        const name = p.split(/[\\/]/).pop()?.replace(/\.txt$/, '') ?? '無題';
        const content = await readTextFile(p);
        return { name, content };
      }),
    );
    await invoke('import_txt_files', { projectId: currentProjectId, files });
    const { loadChapterTree } = useEditorStore.getState();
    await loadChapterTree(currentProjectId);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        className={`header-icon-btn flex-col ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen((o) => !o)}
        style={{
          height: 'auto',
          minHeight: '44px',
          minWidth: '44px',
          padding: '6px 4px 4px',
          gap: '2px',
          justifyContent: 'center',
        }}
      >
        <div className="flex items-center justify-center">
          <IconExport size={20} />
        </div>
        <span style={{ fontSize: '10px', lineHeight: 1, opacity: isOpen ? 1 : 0.8, transform: 'scale(0.95)' }}>
          出力
        </span>
        <span className="tooltip">出力・取込</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1 z-20 rounded-lg py-1 min-w-36"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-light)',
              boxShadow: '0 8px 32px rgba(20,16,12,0.5)',
            }}
          >
            {[
              { label: 'JSONエクスポート', action: handleExportJson },
              { label: 'テキスト出力', action: handleExportTxt },
              { label: 'ZIPで一括出力', action: handleExportZip },
              { label: 'テキスト取込', action: handleImportTxt },
            ].map(({ label, action }) => (
              <button
                key={label}
                className="w-full text-left px-4 py-2 text-xs transition-colors"
                style={{ color: 'var(--text-mid)' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-mid)';
                }}
                onClick={action}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

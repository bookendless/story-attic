import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';

interface Props {
  onImported: () => void;
}

export function ImportExportButtons({ onImported }: Props) {
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async () => {
    const filePath = await open({
      multiple: false,
      filters: [{ name: 'StoryAttic', extensions: ['json'] }],
    });
    if (!filePath) return;

    setIsImporting(true);
    try {
      const text = await readTextFile(filePath as string);
      await invoke('import_project_json', { jsonText: text });
      onImported();
    } catch (e) {
      alert(`インポートに失敗しました: ${e}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        className="btn btn-ghost text-xs"
        style={{
          padding: '4px 12px',
          letterSpacing: '0.05em',
        }}
        onClick={handleImport}
        disabled={isImporting}
      >
        {isImporting ? 'インポート中...' : 'インポート'}
      </button>
    </div>
  );
}

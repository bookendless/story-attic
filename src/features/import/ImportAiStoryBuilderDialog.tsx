/**
 * AI Story Builder ファイルインポートウィザードダイアログ
 */

import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import type {
  ParsedStoryProject,
  ImportOptions,
  ImportResult,
  ImportSections,
} from '@/shared/types';

interface Props {
  onClose: () => void;
  onImported: (projectId: string) => void;
}

const DEFAULT_SECTIONS: ImportSections = {
  characters: true,
  plot: true,
  synopsis: true,
  chapters: true,
  draft: true,
  glossary: true,
  relationships: true,
  worldSettings: true,
  plotThreads: true,
  timeline: true,
};

const SECTION_LABELS: Record<keyof ImportSections, string> = {
  characters: 'キャラクター',
  plot: 'プロット',
  synopsis: 'あらすじ',
  chapters: '章立て',
  draft: '草案（エピソード）',
  glossary: '用語集',
  relationships: 'キャラクター相関図',
  worldSettings: '世界観設定',
  plotThreads: '伏線トラッカー',
  timeline: 'タイムライン',
};

type Step = 'select' | 'preview' | 'importing' | 'done' | 'error';

export function ImportAiStoryBuilderDialog({ onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>('select');
  const [parsed, setParsed] = useState<ParsedStoryProject | null>(null);
  const [sections, setSections] = useState<ImportSections>({ ...DEFAULT_SECTIONS });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSelectFile = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'AI Story Builder', extensions: ['txt', 'md'] }],
      });
      if (!selected) return;

      const filePath = typeof selected === 'string' ? selected : selected[0];
      const raw = await invoke<unknown>('parse_ai_story_builder_file', { path: filePath });
      setParsed(toCamelCase<ParsedStoryProject>(raw));
      setStep('preview');
    } catch (e) {
      setErrorMsg(String(e));
      setStep('error');
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!parsed) return;
    setStep('importing');
    try {
      const options: ImportOptions = {
        targetProjectId: null,
        sections,
      };
      const raw = await invoke<unknown>('import_ai_story_builder', { parsed, options });
      const res = toCamelCase<ImportResult>(raw);
      setResult(res);
      setStep('done');
    } catch (e) {
      setErrorMsg(String(e));
      setStep('error');
    }
  }, [parsed, sections]);

  const toggleSection = (key: keyof ImportSections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex flex-col rounded-xl shadow-2xl"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          width: '480px',
          maxHeight: '80vh',
          overflow: 'hidden',
        }}
      >
        {/* タイトルバー */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
            AI Story Builder からインポート
          </span>
          <button
            onClick={onClose}
            style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
          >
            ✕
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4">
          {step === 'select' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="text-sm text-center" style={{ color: 'var(--text-mid)' }}>
                AI Story Builder で生成した TXT または MD ファイルを選択してください。
              </div>
              <button
                onClick={handleSelectFile}
                className="px-6 py-2 rounded-lg font-medium text-sm"
                style={{ background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}
              >
                ファイルを選択
              </button>
            </div>
          )}

          {step === 'preview' && parsed && (
            <div className="flex flex-col gap-3">
              {/* プロジェクト情報 */}
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div className="font-semibold text-sm mb-1" style={{ color: 'var(--text)' }}>
                  {parsed.title}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {parsed.basicInfo.genre}
                  {parsed.basicInfo.subGenre && ` / ${parsed.basicInfo.subGenre}`}
                </div>
              </div>

              {/* セクション選択 */}
              <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                インポートするセクション
              </div>
              <div className="flex flex-col gap-1">
                {(Object.entries(SECTION_LABELS) as [keyof ImportSections, string][]).map(([key, label]) => {
                  const count = getSectionCount(parsed, key);
                  return (
                    <label
                      key={key}
                      className="flex items-center justify-between px-3 py-1.5 rounded cursor-pointer"
                      style={{ background: sections[key] ? 'var(--accent-soft)' : 'transparent', border: '1px solid var(--border)' }}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={sections[key]}
                          onChange={() => toggleSection(key)}
                          className="w-3 h-3"
                        />
                        <span className="text-xs" style={{ color: 'var(--text)' }}>{label}</span>
                      </div>
                      {count > 0 && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {count}件
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="text-sm" style={{ color: 'var(--text-mid)' }}>インポート中...</div>
            </div>
          )}

          {step === 'done' && result && (
            <div className="flex flex-col gap-3">
              <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                インポート完了
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                {Object.entries(result.counts).map(([key, count]) => {
                  const labels: Record<string, string> = {
                    characters: 'キャラクター',
                    chapters: '章',
                    episodes: 'エピソード',
                    glossaryItems: '用語',
                    relationships: '相関',
                    worldSettings: '世界観設定',
                    plotThreads: '伏線',
                    synopsis: 'あらすじ',
                    plotPhases: 'プロット幕数',
                    timelineEvents: 'タイムライン',
                  };
                  if (!count) return null;
                  return (
                    <div key={key} className="flex justify-between text-xs py-0.5">
                      <span style={{ color: 'var(--text-muted)' }}>{labels[key] ?? key}</span>
                      <span style={{ color: 'var(--text)' }}>{count}件</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'error' && (
            <div className="text-sm p-3 rounded" style={{ background: 'rgba(255,80,80,0.1)', color: '#f87171', border: '1px solid rgba(255,80,80,0.3)' }}>
              エラー: {errorMsg}
            </div>
          )}
        </div>

        {/* フッター */}
        <div
          className="flex items-center justify-end gap-2 px-4 py-3 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          {step === 'preview' && (
            <>
              <button
                onClick={() => setStep('select')}
                className="text-xs px-3 py-1.5 rounded"
                style={{ color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}
              >
                戻る
              </button>
              <button
                onClick={handleImport}
                className="text-xs px-4 py-1.5 rounded font-medium"
                style={{ background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}
              >
                インポート実行
              </button>
            </>
          )}
          {step === 'done' && result && (
            <button
              onClick={() => onImported(result.projectId)}
              className="text-xs px-4 py-1.5 rounded font-medium"
              style={{ background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              プロジェクトを開く
            </button>
          )}
          {(step === 'select' || step === 'error') && (
            <button
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded"
              style={{ color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}
            >
              閉じる
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function getSectionCount(parsed: ParsedStoryProject, key: keyof ImportSections): number {
  switch (key) {
    case 'characters': return parsed.characters.length;
    case 'chapters': return parsed.chapters.length;
    case 'draft': return parsed.drafts.length;
    case 'glossary': return parsed.glossary.length;
    case 'relationships': return parsed.relationships.length;
    case 'worldSettings': return parsed.worldSettings.length;
    case 'plotThreads': return parsed.plotThreads.length;
    case 'timeline': return parsed.timeline.length;
    default: return 0;
  }
}

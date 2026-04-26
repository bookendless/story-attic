import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '@/shared/stores/editorStore';
import { useUIStore } from '@/shared/stores/uiStore';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import type { Character, ProofIssue } from '@/shared/types';

type TabType = 'rules' | 'readability' | 'consistency';

const SEVERITY_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  error:   { color: 'var(--danger)',   bg: 'color-mix(in srgb, var(--danger) 15%, transparent)',   label: 'エラー' },
  warning: { color: 'var(--warning)',  bg: 'color-mix(in srgb, var(--warning) 15%, transparent)',  label: '警告' },
  info:    { color: 'var(--text-mid)', bg: 'var(--bg-surface)', label: '情報' },
};

const TABS: { id: TabType; label: string }[] = [
  { id: 'rules',       label: '校正ルール' },
  { id: 'readability', label: '可読性' },
  { id: 'consistency', label: '一貫性' },
];

function toKatakana(str: string): string {
  return str.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
}
function toHiragana(str: string): string {
  return str.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}
function isPureKana(str: string): boolean {
  return /^[ぁ-ゖァ-ヶ]+$/.test(str);
}

function detectNameVariants(plainText: string, characters: Character[]): ProofIssue[] {
  const issues: ProofIssue[] = [];
  for (const char of characters) {
    const name = char.name.trim();
    if (name.length < 2 || !isPureKana(name)) continue;
    const variants = new Set([toKatakana(name), toHiragana(name)]);
    variants.delete(name);
    for (const variant of variants) {
      let idx = 0;
      while (idx <= plainText.length - variant.length) {
        const pos = plainText.indexOf(variant, idx);
        if (pos === -1) break;
        issues.push({
          category: 'キャラ名表記ゆれ',
          message: `「${char.name}」の表記ゆれ候補「${variant}」が見つかりました`,
          suggestion: char.name,
          offset: [...plainText.slice(0, pos)].length,
          length: [...variant].length,
          severity: 'warning',
        });
        idx = pos + variant.length;
      }
    }
  }
  return issues;
}

/** Rust の strip_html と同一ロジック：</p> </div> </li> <br> を \n に変換 */
function stripHtml(html: string): string {
  let result = '';
  let inTag = false;
  let tagBuf = '';
  for (const ch of html) {
    if (ch === '<') {
      inTag = true;
      tagBuf = '';
    } else if (ch === '>' && inTag) {
      inTag = false;
      const tl = tagBuf.toLowerCase();
      if (
        tl.startsWith('/p') ||
        tl.startsWith('/div') ||
        tl.startsWith('/li') ||
        tl.startsWith('br')
      ) {
        if (!result.endsWith('\n')) result += '\n';
      }
    } else if (inTag) {
      tagBuf += ch;
    } else {
      result += ch;
    }
  }
  return result;
}

function issueKey(issue: ProofIssue): string {
  return `${issue.category}-${issue.offset}-${issue.length}`;
}

export function ProofreadPanel({ editor }: { editor?: Editor | null }) {
  const currentEpisode = useEditorStore((s) => s.currentEpisode);
  const { proofreadSettings, editorViewMode, dismissedIssuesByEpisode, addDismissedIssueKey, removeDismissedIssueKey } = useUIStore();
  const episodeId = currentEpisode?.id ?? '';
  const dismissedIssueKeys = dismissedIssuesByEpisode[episodeId] ?? [];

  const [tab, setTab] = useState<TabType>('rules');
  const [rulesIssues, setRulesIssues] = useState<ProofIssue[]>([]);
  const [readabilityIssues, setReadabilityIssues] = useState<ProofIssue[]>([]);
  const [consistencyIssues, setConsistencyIssues] = useState<ProofIssue[]>([]);
  const [loading, setLoading] = useState(false);

  const runRulesCheck = useCallback(async () => {
    if (!currentEpisode || !proofreadSettings.enabled) { setRulesIssues([]); return; }
    const enabledCategories = Object.entries(proofreadSettings.categories)
      .filter(([, v]) => v).map(([k]) => k);
    setLoading(true);
    try {
      const raw = await invoke<unknown[]>('run_proofread', { text: currentEpisode.body, categories: enabledCategories });
      setRulesIssues(raw.map((r) => toCamelCase<ProofIssue>(r)));
    } catch (e) { console.error('校正ルールエラー:', e); }
    finally { setLoading(false); }
  }, [currentEpisode, proofreadSettings]);

  const runReadabilityCheck = useCallback(async () => {
    if (!currentEpisode) { setReadabilityIssues([]); return; }
    setLoading(true);
    try {
      const raw = await invoke<unknown[]>('run_readability', { text: currentEpisode.body });
      setReadabilityIssues(raw.map((r) => toCamelCase<ProofIssue>(r)));
    } catch (e) { console.error('可読性チェックエラー:', e); }
    finally { setLoading(false); }
  }, [currentEpisode]);

  const runConsistencyCheck = useCallback(async () => {
    if (!currentEpisode) { setConsistencyIssues([]); return; }
    setLoading(true);
    try {
      const [rawStyle, characters] = await Promise.all([
        invoke<unknown[]>('run_consistency_check', { text: currentEpisode.body }),
        currentEpisode.projectId
          ? invoke<unknown[]>('get_characters', { projectId: currentEpisode.projectId })
          : Promise.resolve([]),
      ]);
      const styleIssues = rawStyle.map((r) => toCamelCase<ProofIssue>(r));
      const chars = (characters as unknown[]).map((c) => toCamelCase<Character>(c));
      const plainText = stripHtml(currentEpisode.body);
      setConsistencyIssues([...styleIssues, ...detectNameVariants(plainText, chars)]);
    } catch (e) { console.error('一貫性チェックエラー:', e); }
    finally { setLoading(false); }
  }, [currentEpisode]);

  const runCurrentTab = useCallback(() => {
    if (tab === 'rules') runRulesCheck();
    else if (tab === 'readability') runReadabilityCheck();
    else runConsistencyCheck();
  }, [tab, runRulesCheck, runReadabilityCheck, runConsistencyCheck]);

  useEffect(() => {
    if (editorViewMode !== 'proofread') return;
    const timer = setTimeout(() => runCurrentTab(), 500);
    return () => clearTimeout(timer);
  }, [editorViewMode, tab, currentEpisode?.id, runCurrentTab]);

  // クリックでエディタの該当箇所にジャンプ
  const jumpToIssue = useCallback((issue: ProofIssue) => {
    if (!editor || issue.length === 0) return;

    const plainText = stripHtml(currentEpisode?.body ?? '');
    let matched = plainText.slice(issue.offset, issue.offset + issue.length);
    if (matched.length === 0) return;

    // 改行を含む場合（長文・読点過多など）は最初の空でない行を検索ワードに使用
    let searchOffset = issue.offset;
    if (matched.includes('\n')) {
      const firstLine = matched.split('\n').find(l => l.trim().length > 0) ?? '';
      if (firstLine.length === 0) return;
      searchOffset = issue.offset + matched.indexOf(firstLine);
      matched = firstLine;
    }

    // searchOffset より前に同テキストが何回出現するか = SearchAndReplace results[] のインデックス
    let prior = 0;
    let idx = 0;
    while ((idx = plainText.indexOf(matched, idx)) !== -1 && idx < searchOffset) {
      prior++;
      idx += matched.length;
    }

    editor.commands.setSearchTerm(matched);

    requestAnimationFrame(() => {
      const results: Array<{ from: number; to: number }> =
        editor.storage.searchAndReplace?.results ?? [];
      const target = results[prior] ?? results[0];
      if (!target) { editor.commands.focus(); return; }
      editor.chain().focus().setTextSelection({ from: target.from, to: target.to }).scrollIntoView().run();
    });
  }, [editor, currentEpisode?.body]);

  if (editorViewMode !== 'proofread') return null;

  const currentIssues =
    tab === 'rules' ? rulesIssues :
    tab === 'readability' ? readabilityIssues :
    consistencyIssues;

  const activeCount = currentIssues.filter((i) => !dismissedIssueKeys.includes(issueKey(i))).length;

  const grouped = currentIssues.reduce<Record<string, ProofIssue[]>>((acc, issue) => {
    if (!acc[issue.category]) acc[issue.category] = [];
    acc[issue.category].push(issue);
    return acc;
  }, {});

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)', borderLeft: '1px solid var(--border)' }}>
      {/* ヘッダー */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>校正</span>
        <div className="flex items-center gap-2">
          {loading
            ? <span className="text-xs" style={{ color: 'var(--text-muted)' }}>検査中...</span>
            : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{activeCount} 件</span>
          }
          <button className="btn btn-ghost text-xs" style={{ padding: '2px 8px' }} onClick={runCurrentTab} disabled={loading}>
            再検査
          </button>
        </div>
      </div>

      {/* タブ */}
      <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        {TABS.map(({ id, label }) => {
          const allForTab = id === 'rules' ? rulesIssues : id === 'readability' ? readabilityIssues : consistencyIssues;
          const count = allForTab.filter((i) => !dismissedIssueKeys.includes(issueKey(i))).length;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex-1 text-xs py-2 px-1 transition-colors"
              style={{
                color: tab === id ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: tab === id ? '2px solid var(--accent)' : '2px solid transparent',
                background: 'transparent',
                fontWeight: tab === id ? 600 : 400,
              }}
            >
              {label}
              {count > 0 && (
                <span className="ml-1 px-1 rounded-full" style={{ background: tab === id ? 'var(--accent)' : 'var(--text-muted)', color: 'var(--bg)', fontSize: '10px' }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 結果一覧 */}
      <div className="flex-1 overflow-auto px-2 py-2">
        {currentIssues.length === 0 && !loading && <EmptyState tab={tab} />}
        {Object.entries(grouped).map(([category, catIssues]) => {
          const catActiveCount = catIssues.filter((i) => !dismissedIssueKeys.includes(issueKey(i))).length;
          return (
            <div key={category} className="mb-3">
              <div className="text-xs font-medium px-2 py-1 mb-1" style={{ color: 'var(--text-muted)' }}>
                {category}（{catActiveCount}件）
              </div>
              {catIssues.map((issue, i) => {
                const key = issueKey(issue);
                return (
                  <IssueCard
                    key={`${category}-${i}`}
                    issue={issue}
                    onJump={jumpToIssue}
                    clickable={!!editor && issue.length > 0}
                    isDismissed={dismissedIssueKeys.includes(key)}
                    onDismiss={() => dismissedIssueKeys.includes(key) ? removeDismissedIssueKey(episodeId, key) : addDismissedIssueKey(episodeId, key)}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ tab }: { tab: TabType }) {
  const messages: Record<TabType, string> = {
    rules: '校正ルールに該当する問題はありません',
    readability: '可読性の問題は見つかりませんでした',
    consistency: '一貫性の問題は見つかりませんでした',
  };
  return <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>{messages[tab]}</div>;
}

function IssueCard({
  issue,
  onJump,
  clickable,
  isDismissed,
  onDismiss,
}: {
  issue: ProofIssue;
  onJump: (issue: ProofIssue) => void;
  clickable: boolean;
  isDismissed: boolean;
  onDismiss: () => void;
}) {
  const style = SEVERITY_STYLES[issue.severity] ?? SEVERITY_STYLES.info;
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!menuPos) return;
    const handler = () => setMenuPos(null);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuPos]);

  return (
    <div style={{ position: 'relative' }}>
      <div
        className="rounded-md p-3 mb-2 mx-1 transition-opacity"
        style={{
          background: style.bg,
          border: `1px solid ${style.color}30`,
          cursor: clickable && !isDismissed ? 'pointer' : 'default',
          opacity: isDismissed ? 0.4 : (clickable ? 1 : 0.75),
        }}
        onClick={clickable && !isDismissed ? () => onJump(issue) : undefined}
        onContextMenu={(e) => { e.preventDefault(); setMenuPos({ x: e.clientX, y: e.clientY }); }}
        role={clickable && !isDismissed ? 'button' : undefined}
        tabIndex={clickable && !isDismissed ? 0 : undefined}
        onKeyDown={clickable && !isDismissed ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onJump(issue); } } : undefined}
      >
        <div className="flex items-start gap-2">
          <span
            className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
            style={{ background: style.color, color: 'var(--bg-deep)', fontWeight: 600 }}
          >
            {style.label}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm" style={{ color: 'var(--text)', textDecoration: isDismissed ? 'line-through' : 'none' }}>{issue.message}</p>
            {issue.suggestion && !isDismissed && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-mid)' }}>提案: {issue.suggestion}</p>
            )}
            {issue.offset > 0 && !isDismissed && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                位置: {issue.offset}文字目〜
                {clickable && <span style={{ marginLeft: 4 }}>（クリックでジャンプ）</span>}
              </p>
            )}
            {isDismissed && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>除外済み</p>
            )}
          </div>
        </div>
      </div>
      {menuPos && (
        <div
          style={{ position: 'fixed', top: menuPos.y, left: menuPos.x, zIndex: 9999 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-light)',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            overflow: 'hidden',
            minWidth: '140px',
          }}>
            {isDismissed ? (
              <button
                className="w-full text-left text-xs px-3 py-2 hover:bg-[var(--bg-surface)] transition-colors"
                style={{ color: 'var(--text)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'block', width: '100%' }}
                onMouseDown={(e) => { e.stopPropagation(); onDismiss(); setMenuPos(null); }}
              >
                除外を解除
              </button>
            ) : (
              <button
                className="w-full text-left text-xs px-3 py-2 hover:bg-[var(--bg-surface)] transition-colors"
                style={{ color: 'var(--text)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'block', width: '100%' }}
                onMouseDown={(e) => { e.stopPropagation(); onDismiss(); setMenuPos(null); }}
              >
                この指摘を除外
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

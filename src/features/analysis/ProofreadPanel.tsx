import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '@/shared/stores/editorStore';
import { useUIStore } from '@/shared/stores/uiStore';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import type { Character, ProofIssue, ClicheIssue } from '@/shared/types';
import { buildWorldviewContext } from '@/features/ai/worldviewContext';

type TabType = 'rules' | 'readability' | 'consistency' | 'cliche';

/** AIクリシェ校正の本文文字数上限（Rust 側 ai_get_cliche_check と一致させること） */
const CLICHE_MAX_CHARS = 6000;

const SEVERITY_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  error:   { color: 'var(--danger)',   bg: 'color-mix(in srgb, var(--danger) 15%, transparent)',   label: 'エラー' },
  warning: { color: 'var(--warning)',  bg: 'color-mix(in srgb, var(--warning) 15%, transparent)',  label: '警告' },
  info:    { color: 'var(--text-mid)', bg: 'var(--bg-surface)', label: '情報' },
};

const TABS: { id: TabType; label: string }[] = [
  { id: 'rules',       label: '校正ルール' },
  { id: 'readability', label: '可読性' },
  { id: 'consistency', label: '一貫性' },
  { id: 'cliche',      label: '常套句' },
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

function clicheKey(issue: ClicheIssue): string {
  return `cliche-${issue.phrase}-${issue.offset}`;
}

/** 本文ハッシュ（キャッシュキー用の簡易ハッシュ） */
function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return String(h >>> 0);
}

/** 1件分のオブジェクトを ClicheIssue 形へ正規化（phrase が無ければ null） */
function normalizeClicheObject(o: Record<string, unknown>): Omit<ClicheIssue, 'offset' | 'length'> | null {
  const phrase = typeof o.phrase === 'string' ? o.phrase : '';
  if (!phrase.trim()) return null;
  const suggestions = Array.isArray(o.suggestions)
    ? o.suggestions.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 3)
    : [];
  return {
    phrase,
    context: typeof o.context === 'string' ? o.context : '',
    reason: typeof o.reason === 'string' ? o.reason : '',
    suggestions,
  };
}

/**
 * AIレスポンス文字列から issue 配列を抽出する。
 * 出力が max_tokens で途中切れしても、完成済みの { ... } を救出するため
 * 文字列状態を考慮した波括弧マッチングで全オブジェクトを走査する。
 */
function parseClicheResponse(raw: string): Omit<ClicheIssue, 'offset' | 'length'>[] {
  const result: Omit<ClicheIssue, 'offset' | 'length'>[] = [];
  const stack: number[] = [];
  let inStr = false;
  let escape = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') {
      stack.push(i);
    } else if (ch === '}') {
      const start = stack.pop();
      if (start === undefined) continue;
      try {
        const parsed: unknown = JSON.parse(raw.slice(start, i + 1));
        if (parsed && typeof parsed === 'object') {
          const norm = normalizeClicheObject(parsed as Record<string, unknown>);
          if (norm) result.push(norm);
        }
      } catch { /* 不完全なオブジェクトはスキップ */ }
    }
  }
  return result;
}

/** クリシェ表現の平文中の位置を特定する（context 優先、なければ phrase 直接） */
function locateCliche(plainText: string, phrase: string, context: string): { offset: number; length: number } {
  if (context) {
    const ctxIdx = plainText.indexOf(context);
    if (ctxIdx !== -1) {
      const inCtx = context.indexOf(phrase);
      if (inCtx !== -1) return { offset: ctxIdx + inCtx, length: phrase.length };
    }
  }
  const direct = plainText.indexOf(phrase);
  if (direct !== -1) return { offset: direct, length: phrase.length };
  return { offset: -1, length: 0 };
}

export function ProofreadPanel({ editor }: { editor?: Editor | null }) {
  const currentEpisode = useEditorStore((s) => s.currentEpisode);
  const { proofreadSettings, editorViewMode, dismissedIssuesByEpisode, addDismissedIssueKey, removeDismissedIssueKey, openSettingsModal } = useUIStore();
  const episodeId = currentEpisode?.id ?? '';
  const dismissedIssueKeys = dismissedIssuesByEpisode[episodeId] ?? [];

  const [tab, setTab] = useState<TabType>('rules');
  const [rulesIssues, setRulesIssues] = useState<ProofIssue[]>([]);
  const [readabilityIssues, setReadabilityIssues] = useState<ProofIssue[]>([]);
  const [consistencyIssues, setConsistencyIssues] = useState<ProofIssue[]>([]);
  const [loading, setLoading] = useState(false);

  // クリシェ（AI）校正の状態
  const [clicheIssues, setClicheIssues] = useState<ClicheIssue[]>([]);
  const [clicheLoading, setClicheLoading] = useState(false);
  const [clicheError, setClicheError] = useState<string | null>(null);
  const [clicheHasRun, setClicheHasRun] = useState(false);
  const [clicheNotice, setClicheNotice] = useState<string | null>(null);
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);
  const [confirmReplace, setConfirmReplace] = useState<{ issue: ClicheIssue; suggestion: string } | null>(null);
  const clicheCacheRef = useRef<Map<string, ClicheIssue[]>>(new Map());

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
    else if (tab === 'consistency') runConsistencyCheck();
    // cliche タブは API 課金が発生するため手動実行のみ（自動実行しない）
  }, [tab, runRulesCheck, runReadabilityCheck, runConsistencyCheck]);

  useEffect(() => {
    if (editorViewMode !== 'proofread') return;
    const timer = setTimeout(() => runCurrentTab(), 500);
    return () => clearTimeout(timer);
  }, [editorViewMode, tab, currentEpisode?.id, runCurrentTab]);

  // プロジェクト変更時に API 設定チェック結果をリセット
  useEffect(() => {
    setApiConfigured(null);
  }, [currentEpisode?.projectId]);

  // エピソード変更時にクリシェ結果表示をクリア（キャッシュは保持）
  useEffect(() => {
    setClicheIssues([]);
    setClicheError(null);
    setClicheHasRun(false);
    setClicheNotice(null);
  }, [currentEpisode?.id]);

  // 常套句タブを開いたとき、AI（API）が設定済みかを1回だけ確認
  useEffect(() => {
    if (editorViewMode !== 'proofread' || tab !== 'cliche' || apiConfigured !== null) return;
    const projectId = currentEpisode?.projectId;
    if (!projectId) { setApiConfigured(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const settings = await invoke<{ provider: string; model: string }>('ai_get_settings', { projectId });
        if (!settings.provider || !settings.model) {
          if (!cancelled) setApiConfigured(false);
          return;
        }
        const hasKey = await invoke<boolean>('has_api_key', { service: settings.provider });
        if (!cancelled) setApiConfigured(!!hasKey);
      } catch {
        if (!cancelled) setApiConfigured(false);
      }
    })();
    return () => { cancelled = true; };
  }, [editorViewMode, tab, currentEpisode?.projectId, apiConfigured]);

  // AIクリシェ校正を実行（手動ボタンから呼ぶ）
  const runClicheCheck = useCallback(async () => {
    const projectId = currentEpisode?.projectId;
    if (!currentEpisode || !projectId) { setClicheIssues([]); return; }
    if (apiConfigured !== true) {
      setClicheError('AI（API）が設定されていません。設定画面でプロバイダー・モデル・APIキーを登録してください。');
      return;
    }

    const body = currentEpisode.body;
    const cacheKey = `${currentEpisode.id}:${simpleHash(body)}`;
    const plainText = stripHtml(body);

    setClicheNotice(
      plainText.length > CLICHE_MAX_CHARS
        ? `本文が長いため、先頭 ${CLICHE_MAX_CHARS} 文字のみを検査対象としています。`
        : null
    );

    const cached = clicheCacheRef.current.get(cacheKey);
    if (cached) {
      setClicheIssues(cached);
      setClicheError(null);
      setClicheHasRun(true);
      return;
    }

    setClicheLoading(true);
    setClicheError(null);
    try {
      const worldview = await buildWorldviewContext(projectId);
      const rawResp = await invoke<string>('ai_get_cliche_check', {
        projectId,
        content: plainText,
        worldview,
      });
      const parsed = parseClicheResponse(rawResp);
      const issues: ClicheIssue[] = parsed.map((p) => {
        const loc = locateCliche(plainText, p.phrase, p.context);
        return { ...p, offset: loc.offset, length: loc.length };
      });
      clicheCacheRef.current.set(cacheKey, issues);
      setClicheIssues(issues);
      setClicheHasRun(true);
    } catch (e) {
      console.error('クリシェ校正エラー:', e);
      setClicheError(`AI検査に失敗しました: ${String(e)}`);
    } finally {
      setClicheLoading(false);
    }
  }, [currentEpisode, apiConfigured]);

  // 平文オフセットからエディタの該当箇所にジャンプ
  const jumpToRange = useCallback((offset: number, length: number) => {
    if (!editor || length === 0 || offset < 0) return;

    const plainText = stripHtml(currentEpisode?.body ?? '');
    let matched = plainText.slice(offset, offset + length);
    if (matched.length === 0) return;

    // 改行を含む場合（長文・読点過多など）は最初の空でない行を検索ワードに使用
    let searchOffset = offset;
    if (matched.includes('\n')) {
      const firstLine = matched.split('\n').find(l => l.trim().length > 0) ?? '';
      if (firstLine.length === 0) return;
      searchOffset = offset + matched.indexOf(firstLine);
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

  const jumpToIssue = useCallback((issue: ProofIssue) => {
    jumpToRange(issue.offset, issue.length);
  }, [jumpToRange]);

  // クリシェ表現を代替表現で置き換える（確認ダイアログ確定後に呼ぶ）
  const applyReplacement = useCallback((issue: ClicheIssue, replacement: string) => {
    if (!editor || issue.length === 0 || issue.offset < 0) return;

    const plainText = stripHtml(currentEpisode?.body ?? '');
    const matched = plainText.slice(issue.offset, issue.offset + issue.length);
    if (matched.length === 0 || matched.includes('\n')) return;

    let prior = 0;
    let idx = 0;
    while ((idx = plainText.indexOf(matched, idx)) !== -1 && idx < issue.offset) {
      prior++;
      idx += matched.length;
    }

    editor.commands.setSearchTerm(matched);

    requestAnimationFrame(() => {
      const results: Array<{ from: number; to: number }> =
        editor.storage.searchAndReplace?.results ?? [];
      const target = results[prior] ?? results[0];
      if (!target) return;
      editor.chain().focus()
        .setTextSelection({ from: target.from, to: target.to })
        .insertContent(replacement)
        .scrollIntoView()
        .run();
    });
  }, [editor, currentEpisode?.body]);

  if (editorViewMode !== 'proofread') return null;

  const currentIssues: ProofIssue[] =
    tab === 'rules' ? rulesIssues :
    tab === 'readability' ? readabilityIssues :
    tab === 'consistency' ? consistencyIssues :
    [];

  const activeCount = tab === 'cliche'
    ? clicheIssues.filter((i) => !dismissedIssueKeys.includes(clicheKey(i))).length
    : currentIssues.filter((i) => !dismissedIssueKeys.includes(issueKey(i))).length;

  const grouped = currentIssues.reduce<Record<string, ProofIssue[]>>((acc, issue) => {
    if (!acc[issue.category]) acc[issue.category] = [];
    acc[issue.category].push(issue);
    return acc;
  }, {});

  const isBusy = loading || clicheLoading;

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)', borderLeft: '1px solid var(--border)' }}>
      {/* ヘッダー */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>校正</span>
        <div className="flex items-center gap-2">
          {isBusy
            ? <span className="text-xs" style={{ color: 'var(--text-muted)' }}>検査中...</span>
            : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{activeCount} 件</span>
          }
          <button
            className="btn btn-ghost text-xs"
            style={{ padding: '2px 8px' }}
            onClick={tab === 'cliche' ? runClicheCheck : runCurrentTab}
            disabled={isBusy || (tab === 'cliche' && apiConfigured !== true)}
          >
            {tab === 'cliche' ? 'AI検査' : '再検査'}
          </button>
        </div>
      </div>

      {/* タブ */}
      <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        {TABS.map(({ id, label }) => {
          const count = id === 'cliche'
            ? clicheIssues.filter((i) => !dismissedIssueKeys.includes(clicheKey(i))).length
            : (id === 'rules' ? rulesIssues : id === 'readability' ? readabilityIssues : consistencyIssues)
                .filter((i) => !dismissedIssueKeys.includes(issueKey(i))).length;
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
        {tab === 'cliche' ? (
          <ClicheResults
            issues={clicheIssues}
            loading={clicheLoading}
            error={clicheError}
            notice={clicheNotice}
            hasRun={clicheHasRun}
            apiConfigured={apiConfigured}
            dismissedKeys={dismissedIssueKeys}
            editor={editor}
            onOpenApiSettings={() => openSettingsModal('ai')}
            onJump={(i) => jumpToRange(i.offset, i.length)}
            onApply={(issue, suggestion) => setConfirmReplace({ issue, suggestion })}
            onDismiss={(key) => dismissedIssueKeys.includes(key)
              ? removeDismissedIssueKey(episodeId, key)
              : addDismissedIssueKey(episodeId, key)}
          />
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* 置換確認ダイアログ */}
      {confirmReplace && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setConfirmReplace(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '20px', maxWidth: '380px', margin: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--text)', marginBottom: '12px' }}>常套句の置き換え</p>
            <p className="text-xs" style={{ color: 'var(--text-mid)', lineHeight: 1.7 }}>
              本文中の「<span style={{ color: 'var(--danger)', fontWeight: 600 }}>{confirmReplace.issue.phrase}</span>」を
              「<span style={{ color: 'var(--accent)', fontWeight: 600 }}>{confirmReplace.suggestion}</span>」に置き換えます。よろしいですか？
            </p>
            <div className="flex justify-end gap-2" style={{ marginTop: '18px' }}>
              <button
                className="btn btn-ghost text-xs"
                style={{ padding: '4px 12px' }}
                onClick={() => setConfirmReplace(null)}
              >
                キャンセル
              </button>
              <button
                className="text-xs"
                style={{ padding: '4px 12px', borderRadius: '6px', background: 'var(--accent)', color: 'var(--bg-deep)', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                onClick={() => {
                  applyReplacement(confirmReplace.issue, confirmReplace.suggestion);
                  // 適用済みの指摘は除外して完了を明示（置換で他の指摘の位置がずれるため再検査を推奨）
                  addDismissedIssueKey(episodeId, clicheKey(confirmReplace.issue));
                  setConfirmReplace(null);
                }}
              >
                置き換える
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ tab }: { tab: TabType }) {
  const messages: Record<TabType, string> = {
    rules: '校正ルールに該当する問題はありません',
    readability: '可読性の問題は見つかりませんでした',
    consistency: '一貫性の問題は見つかりませんでした',
    cliche: '',
  };
  return <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>{messages[tab]}</div>;
}

function ClicheResults({
  issues,
  loading,
  error,
  notice,
  hasRun,
  apiConfigured,
  dismissedKeys,
  editor,
  onOpenApiSettings,
  onJump,
  onApply,
  onDismiss,
}: {
  issues: ClicheIssue[];
  loading: boolean;
  error: string | null;
  notice: string | null;
  hasRun: boolean;
  apiConfigured: boolean | null;
  dismissedKeys: string[];
  editor?: Editor | null;
  onOpenApiSettings: () => void;
  onJump: (issue: ClicheIssue) => void;
  onApply: (issue: ClicheIssue, suggestion: string) => void;
  onDismiss: (key: string) => void;
}) {
  if (apiConfigured === false) {
    return (
      <div className="text-sm text-center py-8 px-4" style={{ color: 'var(--text-muted)', lineHeight: 1.8 }}>
        AI（API）が設定されていません。<br />
        プロバイダー・モデル・APIキーを登録すると、常套句のAI校正が利用できます。
        <div style={{ marginTop: '12px' }}>
          <button
            className="text-xs"
            style={{ padding: '5px 14px', borderRadius: '6px', background: 'var(--accent)', color: 'var(--bg-deep)', fontWeight: 600, border: 'none', cursor: 'pointer' }}
            onClick={onOpenApiSettings}
          >
            API設定を開く
          </button>
        </div>
      </div>
    );
  }
  if (loading) {
    return <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>AIが本文を解析中...</div>;
  }
  if (error) {
    return <div className="text-sm text-center py-8 px-4" style={{ color: 'var(--danger)', lineHeight: 1.7 }}>{error}</div>;
  }
  if (issues.length === 0) {
    return (
      <div className="text-sm text-center py-8 px-4" style={{ color: 'var(--text-muted)', lineHeight: 1.8 }}>
        {hasRun
          ? '常套句は見つかりませんでした'
          : '「AI検査」ボタンを押すと、本文中の常套句をAIが抽出し、世界観に沿った代替表現を提案します。'}
      </div>
    );
  }

  const activeCount = issues.filter((i) => !dismissedKeys.includes(clicheKey(i))).length;

  return (
    <div className="mb-3">
      {notice && (
        <div className="text-xs px-2 py-1 mb-2 rounded" style={{ color: 'var(--warning)', background: 'color-mix(in srgb, var(--warning) 12%, transparent)' }}>
          {notice}
        </div>
      )}
      <div className="text-xs font-medium px-2 py-1 mb-1" style={{ color: 'var(--text-muted)' }}>
        常套句（{activeCount}件）
      </div>
      {issues.map((issue, i) => {
        const key = clicheKey(issue);
        return (
          <ClicheCard
            key={`cliche-${i}`}
            issue={issue}
            clickable={!!editor && issue.offset >= 0 && issue.length > 0}
            isDismissed={dismissedKeys.includes(key)}
            onJump={onJump}
            onApply={onApply}
            onDismiss={() => onDismiss(key)}
          />
        );
      })}
    </div>
  );
}

function ClicheCard({
  issue,
  clickable,
  isDismissed,
  onJump,
  onApply,
  onDismiss,
}: {
  issue: ClicheIssue;
  clickable: boolean;
  isDismissed: boolean;
  onJump: (issue: ClicheIssue) => void;
  onApply: (issue: ClicheIssue, suggestion: string) => void;
  onDismiss: () => void;
}) {
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
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          opacity: isDismissed ? 0.4 : 1,
        }}
        onContextMenu={(e) => { e.preventDefault(); setMenuPos({ x: e.clientX, y: e.clientY }); }}
      >
        <div className="flex items-start gap-2">
          <span
            className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
            style={{ background: 'var(--accent)', color: 'var(--bg-deep)', fontWeight: 600 }}
          >
            常套句
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm" style={{ color: 'var(--text)', textDecoration: isDismissed ? 'line-through' : 'none' }}>
              「{issue.phrase}」
            </p>

            {!isDismissed && issue.reason && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-mid)' }}>{issue.reason}</p>
            )}

            {!isDismissed && issue.suggestions.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>代替表現の候補:</span>
                {issue.suggestions.map((s, si) => (
                  <div key={si} className="flex items-center gap-2">
                    <span className="text-xs flex-1 min-w-0" style={{ color: 'var(--text)' }}>・{s}</span>
                    <button
                      className="btn btn-ghost text-xs flex-shrink-0"
                      style={{ padding: '1px 8px' }}
                      disabled={!clickable}
                      title={clickable ? '本文を置き換え（確認あり）' : '本文中の位置を特定できないため適用できません'}
                      onClick={() => onApply(issue, s)}
                    >
                      適用
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!isDismissed && issue.offset >= 0 && (
              <p
                className="text-xs mt-2"
                style={{ color: 'var(--text-muted)', cursor: clickable ? 'pointer' : 'default' }}
                onClick={clickable ? () => onJump(issue) : undefined}
              >
                位置: {issue.offset}文字目〜
                {clickable && <span style={{ marginLeft: 4 }}>（クリックでジャンプ）</span>}
              </p>
            )}
            {!isDismissed && issue.offset < 0 && (
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                ※本文中の位置を特定できませんでした
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
            <button
              className="w-full text-left text-xs px-3 py-2 hover:bg-[var(--bg-surface)] transition-colors"
              style={{ color: 'var(--text)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'block', width: '100%' }}
              onMouseDown={(e) => { e.stopPropagation(); onDismiss(); setMenuPos(null); }}
            >
              {isDismissed ? '除外を解除' : 'この指摘を除外'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
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

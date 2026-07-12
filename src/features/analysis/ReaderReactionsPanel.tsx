import { useState, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '@/shared/stores/editorStore';
import { useUIStore } from '@/shared/stores/uiStore';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import type { ReaderReaction } from '@/shared/types';
import { stripHtml, jumpToPlainOffset } from './textAnchoring';
import {
  READER_PERSONAS,
  MAX_SELECTED_PERSONAS,
  getPersonaMeta,
  loadSelectedPersonas,
  saveSelectedPersonas,
} from './readerPersonas';

/** 読者反応の本文文字数上限（Rust 側 ai_get_reader_reactions の REACTION_MAX_CHARS と一致させること） */
const REACTION_MAX_CHARS = 8000;

/** 反応種別の表示メタ */
const KIND_STYLES: Record<string, { icon: string; label: string; color: string }> = {
  emotion:    { icon: '💓', label: '感情',     color: 'var(--accent)' },
  prediction: { icon: '🔮', label: '予想',     color: '#7c9fd4' },
  concern:    { icon: '⚠️', label: '離脱懸念', color: 'var(--warning)' },
};

/** 1件分のオブジェクトを反応入力形へ正規化（comment が無ければ null） */
function normalizeReactionObject(
  o: Record<string, unknown>,
): { quote: string; comment: string; kind: string } | null {
  const comment = typeof o.comment === 'string' ? o.comment.trim() : '';
  if (!comment) return null;
  const kindRaw = typeof o.kind === 'string' ? o.kind : '';
  return {
    quote: typeof o.quote === 'string' ? o.quote.trim() : '',
    comment,
    kind: KIND_STYLES[kindRaw] ? kindRaw : 'emotion',
  };
}

/**
 * AIレスポンス文字列から反応配列を抽出する。
 * 出力が max_tokens で途中切れしても完成済みの { ... } を救出するため、
 * 文字列状態を考慮した波括弧マッチングで全オブジェクトを走査する
 * （ProofreadPanel の parseClicheResponse と同方式）。
 */
function parseReactionsResponse(raw: string): { quote: string; comment: string; kind: string }[] {
  const result: { quote: string; comment: string; kind: string }[] = [];
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
      // トップレベルの {"reactions": ...} 自体は個別オブジェクトとして扱わない
      try {
        const parsed: unknown = JSON.parse(raw.slice(start, i + 1));
        if (parsed && typeof parsed === 'object' && !('reactions' in (parsed as object))) {
          const norm = normalizeReactionObject(parsed as Record<string, unknown>);
          if (norm) result.push(norm);
        }
      } catch { /* 不完全なオブジェクトはスキップ */ }
    }
  }
  return result;
}

export function ReaderReactionsPanel({ editor }: { editor?: Editor | null }) {
  const currentEpisode = useEditorStore((s) => s.currentEpisode);
  const editorViewMode = useUIStore((s) => s.editorViewMode);
  const episodeId = currentEpisode?.id ?? '';
  const projectId = currentEpisode?.projectId ?? '';

  const [reactions, setReactions] = useState<ReaderReaction[]>([]);
  const [loadingPersonas, setLoadingPersonas] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>(loadSelectedPersonas);
  const [personaPickerOpen, setPersonaPickerOpen] = useState(false);

  const plainText = useMemo(
    () => stripHtml(currentEpisode?.body ?? ''),
    [currentEpisode?.body],
  );

  // 保存済みの反応を復元（エピソード切替時）
  useEffect(() => {
    if (!episodeId) { setReactions([]); return; }
    let cancelled = false;
    void (async () => {
      try {
        const raw = await invoke<unknown[]>('list_reader_reactions', { episodeId });
        if (!cancelled) setReactions(raw.map((r) => toCamelCase<ReaderReaction>(r)));
      } catch (e) {
        console.error('読者反応の読込エラー:', e);
      }
    })();
    setError(null);
    setNotice(null);
    return () => { cancelled = true; };
  }, [episodeId]);

  // プロジェクト変更時に API 設定チェック結果をリセット
  useEffect(() => {
    setApiConfigured(null);
  }, [projectId]);

  // パネルを開いたとき、AI（API）が設定済みかを1回だけ確認（ProofreadPanel と同方式）
  useEffect(() => {
    if (editorViewMode !== 'reactions' || apiConfigured !== null) return;
    if (!projectId) { setApiConfigured(false); return; }
    let cancelled = false;
    void (async () => {
      try {
        const settings = await invoke<{ provider: string; model: string }>('ai_get_settings', { projectId });
        const modelOk = !!settings.model || settings.provider === 'local';
        if (!settings.provider || !modelOk) {
          if (!cancelled) setApiConfigured(false);
          return;
        }
        if (settings.provider === 'local') {
          if (!cancelled) setApiConfigured(true);
          return;
        }
        const hasKey = await invoke<boolean>('has_api_key', { service: settings.provider });
        if (!cancelled) setApiConfigured(!!hasKey);
      } catch {
        if (!cancelled) setApiConfigured(false);
      }
    })();
    return () => { cancelled = true; };
  }, [editorViewMode, projectId, apiConfigured]);

  // パネルを閉じた（アンマウント）際、ジャンプで付与した検索ハイライトを解除する
  useEffect(() => {
    return () => {
      if (!editor || editor.isDestroyed) return;
      editor.commands.setSearchTerm('');
    };
  }, [editor]);

  const togglePersona = useCallback((id: string) => {
    setSelectedPersonas((prev) => {
      const next = prev.includes(id)
        ? prev.filter((p) => p !== id)
        : prev.length < MAX_SELECTED_PERSONAS
          ? [...prev, id]
          : prev;
      if (next.length > 0) saveSelectedPersonas(next);
      return next.length > 0 ? next : prev;
    });
  }, []);

  // 選択中ペルソナ分の反応を並列生成する（完了順に表示）
  const runReactions = useCallback(async () => {
    if (!episodeId || !projectId || selectedPersonas.length === 0) return;
    if (apiConfigured !== true) {
      setError('AI（API）が設定されていません。設定画面でプロバイダー・モデル・APIキーを登録してください。');
      return;
    }

    setError(null);
    setNotice(
      plainText.length > REACTION_MAX_CHARS
        ? `本文が長いため、読者は先頭 ${REACTION_MAX_CHARS} 文字まで読みます。`
        : null,
    );
    setLoadingPersonas([...selectedPersonas]);

    const failures: string[] = [];
    await Promise.all(
      selectedPersonas.map(async (persona) => {
        try {
          const raw = await invoke<string>('ai_get_reader_reactions', {
            projectId,
            episodeId,
            persona,
          });
          const parsed = parseReactionsResponse(raw);
          const saved = await invoke<unknown[]>('save_reader_reactions', {
            episodeId,
            persona,
            reactions: parsed,
          });
          const items = saved.map((r) => toCamelCase<ReaderReaction>(r));
          setReactions((prev) => [...prev.filter((r) => r.persona !== persona), ...items]);
        } catch (e) {
          console.error(`読者反応エラー (${persona}):`, e);
          failures.push(getPersonaMeta(persona).name);
        } finally {
          setLoadingPersonas((prev) => prev.filter((p) => p !== persona));
        }
      }),
    );

    if (failures.length > 0) {
      setError(`${failures.join('・')} の反応取得に失敗しました。`);
    }
  }, [episodeId, projectId, selectedPersonas, apiConfigured, plainText]);

  const clearReactions = useCallback(async () => {
    if (!episodeId) return;
    try {
      await invoke('delete_reader_reactions', { episodeId });
      setReactions([]);
      setError(null);
      setNotice(null);
    } catch (e) {
      console.error('読者反応の削除エラー:', e);
    }
  }, [episodeId]);

  const jumpToQuote = useCallback((quote: string) => {
    if (!editor || !quote) return;
    const offset = plainText.indexOf(quote);
    if (offset === -1) return;
    jumpToPlainOffset(editor, plainText, offset, quote.length);
  }, [editor, plainText]);

  // 本文の登場順に並べる（アンカー不明・章全体感想は末尾）
  const sortedReactions = useMemo(() => {
    const withPos = reactions.map((r) => ({
      reaction: r,
      pos: r.quote ? plainText.indexOf(r.quote) : -1,
    }));
    withPos.sort((a, b) => {
      if (a.pos === -1 && b.pos === -1) return 0;
      if (a.pos === -1) return 1;
      if (b.pos === -1) return -1;
      return a.pos - b.pos;
    });
    return withPos;
  }, [reactions, plainText]);

  if (editorViewMode !== 'reactions') return null;

  const isBusy = loadingPersonas.length > 0;

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)', borderLeft: '1px solid var(--border)' }}>
      {/* ヘッダー */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>読者の反応</span>
        <div className="flex items-center gap-2">
          {isBusy
            ? <span className="text-xs" style={{ color: 'var(--text-muted)' }}>読んでいます...</span>
            : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{reactions.length} 件</span>
          }
          {reactions.length > 0 && !isBusy && (
            <button
              className="btn btn-ghost text-xs"
              style={{ padding: '2px 8px' }}
              onClick={() => void clearReactions()}
            >
              クリア
            </button>
          )}
          <button
            className="btn btn-ghost text-xs"
            style={{ padding: '2px 8px', color: 'var(--accent)' }}
            onClick={() => void runReactions()}
            disabled={isBusy || apiConfigured !== true || selectedPersonas.length === 0}
          >
            読者に見せる
          </button>
        </div>
      </div>

      {/* ペルソナ選択 */}
      <div
        className="flex-shrink-0 px-3 py-2"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        <button
          className="w-full flex items-center justify-between text-xs"
          style={{ background: 'transparent', border: 'none', color: 'var(--text-mid)', cursor: 'pointer', padding: '2px 0' }}
          onClick={() => setPersonaPickerOpen((v) => !v)}
        >
          <span className="flex items-center gap-1 flex-wrap">
            {selectedPersonas.map((id) => {
              const meta = getPersonaMeta(id);
              return (
                <span key={id} title={meta.name}>
                  {meta.icon} {meta.name}
                </span>
              );
            })}
          </span>
          <span style={{ fontSize: '9px', opacity: 0.7 }}>{personaPickerOpen ? '▴' : '▾'}</span>
        </button>

        {personaPickerOpen && (
          <div className="mt-2 flex flex-col gap-1">
            {READER_PERSONAS.map((meta) => {
              const selected = selectedPersonas.includes(meta.id);
              const selectable = selected || selectedPersonas.length < MAX_SELECTED_PERSONAS;
              return (
                <button
                  key={meta.id}
                  onClick={() => togglePersona(meta.id)}
                  disabled={!selectable && !selected}
                  className="flex items-start gap-2 text-left rounded px-2 py-1.5 transition-colors"
                  style={{
                    background: selected ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                    border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                    cursor: selectable ? 'pointer' : 'not-allowed',
                    opacity: selectable ? 1 : 0.4,
                  }}
                >
                  <span style={{ fontSize: '14px' }}>{meta.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs" style={{ color: 'var(--text)' }}>{meta.name}</span>
                    <span className="block" style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{meta.desc}</span>
                  </span>
                  {selected && <span style={{ color: 'var(--accent)', fontSize: '11px' }}>●</span>}
                </button>
              );
            })}
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '2px 2px 0' }}>
              最大 {MAX_SELECTED_PERSONAS} 人まで選べます
            </div>
          </div>
        )}
      </div>

      {/* 結果一覧 */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {apiConfigured === false && (
          <div className="text-xs rounded p-3 mb-2" style={{ background: 'var(--bg-surface)', color: 'var(--text-mid)', lineHeight: 1.6 }}>
            AI（API）が未設定です。設定画面でプロバイダー・モデル・APIキーを登録すると、AI読者が章を読んで反応します。
          </div>
        )}
        {error && (
          <div className="text-xs rounded p-3 mb-2" style={{ background: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger)', lineHeight: 1.6 }}>
            {error}
          </div>
        )}
        {notice && (
          <div className="text-xs rounded p-2 mb-2" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
            {notice}
          </div>
        )}

        {/* 読み込み中のペルソナ */}
        {loadingPersonas.map((persona) => {
          const meta = getPersonaMeta(persona);
          return (
            <div
              key={`loading-${persona}`}
              className="rounded p-3 mb-2 animate-pulse"
              style={{ background: 'var(--bg-surface)', borderLeft: `3px solid ${meta.color}` }}
            >
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {meta.icon} {meta.name} が読んでいます...
              </span>
            </div>
          );
        })}

        {reactions.length === 0 && loadingPersonas.length === 0 && apiConfigured !== false && !error && (
          <div className="text-xs text-center py-8" style={{ color: 'var(--text-muted)', lineHeight: 1.8 }}>
            まだ誰も読んでいません。<br />
            「読者に見せる」を押すと、AI読者{selectedPersonas.length}人が<br />
            この章を読んでコメントします。
          </div>
        )}

        {sortedReactions.map(({ reaction, pos }) => {
          const meta = getPersonaMeta(reaction.persona);
          const kind = KIND_STYLES[reaction.kind] ?? KIND_STYLES.emotion;
          const anchored = pos !== -1 && reaction.quote.length > 0;
          return (
            <button
              key={reaction.id}
              onClick={() => anchored && jumpToQuote(reaction.quote)}
              className="w-full text-left rounded p-3 mb-2 transition-colors"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${meta.color}`,
                cursor: anchored ? 'pointer' : 'default',
              }}
              title={anchored ? 'クリックで該当箇所へジャンプ' : undefined}
            >
              <div className="flex items-center gap-1 mb-1">
                <span className="text-xs" style={{ color: meta.color, fontWeight: 600 }}>
                  {meta.icon} {meta.name}
                </span>
                <span
                  className="rounded-full px-1.5"
                  style={{ fontSize: '9px', color: kind.color, border: `1px solid ${kind.color}`, marginLeft: 'auto' }}
                >
                  {kind.icon} {kind.label}
                </span>
              </div>
              <div className="text-xs" style={{ color: 'var(--text)', lineHeight: 1.7 }}>
                {reaction.comment}
              </div>
              {anchored && (
                <div className="mt-1 truncate" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  ❝{reaction.quote}❞
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

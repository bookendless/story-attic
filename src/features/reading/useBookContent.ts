/**
 * 読書モード用の本文構築フック
 *
 * editorStore の章ツリー（章 + エピソード構造）を読み順に走査し、
 * 「章扉」と「エピソード本文」のセクション列を組み立てる。
 * エピソード本文はツリーには含まれない（要約のみ）ため、
 * get_episode コマンドで個別に取得し、取得時に一度だけサニタイズして保持する。
 *
 * 安全策:
 * - プロジェクト切替直後は editorStore に旧プロジェクトのツリーが残っているため、
 *   ツリー内の projectId が現在のプロジェクトと一致するまで「読込中」として扱い、
 *   旧本文の表示・しおりの汚染を防ぐ。
 * - 再取得はエピソードの ID と updatedAt が変わったときのみ行う。文字数のローカル
 *   反映などでツリーの参照だけが変わっても、全話の再フェッチは走らない。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useEditorStore } from '@/shared/stores/editorStore';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import { sanitizeHtml } from '@/shared/utils/sanitizeHtml';
import type { Episode } from '@/shared/types';

/**
 * 傍点 span を1文字ずつの ruby(・) に変換する。
 * text-emphasis は Chromium が line box を無条件に膨張させ、読書モードの
 * 列ピッチ（= line-height 一定）前提を崩すため、レイアウトに影響しない
 * ルビ注記として傍点を描画する（ルビの膨張は line-height 2.1 + rt line-height 1 で解消済み）。
 */
function dotenToRuby(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  for (const span of Array.from(div.querySelectorAll('span.doten'))) {
    const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let node = walker.nextNode();
    while (node) {
      textNodes.push(node as Text);
      node = walker.nextNode();
    }
    for (const tn of textNodes) {
      const frag = document.createDocumentFragment();
      for (const ch of tn.textContent ?? '') {
        const ruby = document.createElement('ruby');
        ruby.className = 'doten-ruby';
        ruby.append(ch);
        const rt = document.createElement('rt');
        rt.textContent = '・';
        ruby.appendChild(rt);
        frag.appendChild(ruby);
      }
      tn.replaceWith(frag);
    }
    // text-emphasis の再発を防ぐ（span 自体は残し他のマークは維持）
    span.classList.remove('doten');
  }
  return div.innerHTML;
}

/** 章扉セクション */
export interface CoverSection {
  kind: 'cover';
  chapterId: string;
  title: string;
  mood: string;
  summary: string;
  /** この章の先頭エピソードID（しおり復元用） */
  firstEpisodeId: string | null;
}

/** エピソード本文セクション */
export interface EpisodeSection {
  kind: 'episode';
  episodeId: string;
  chapterId: string | null;
  title: string;
  /** エピソード本文 HTML（サニタイズ済み。そのまま描画してよい） */
  html: string;
}

export type BookSection = CoverSection | EpisodeSection;

interface BookContent {
  sections: BookSection[];
  loading: boolean;
  /** 作品全体の総文字数（読了予測用） */
  totalChars: number;
}

/**
 * 読書モードが有効なとき、現在プロジェクトの本文セクション列を構築する。
 * @param active 読書モードが開いているか（false の間は取得しない）
 * @param projectId 現在のプロジェクトID（章ツリーとの整合確認に使う）
 */
export function useBookContent(active: boolean, projectId: string | null): BookContent {
  const chapterTree = useEditorStore((s) => s.chapterTree);
  const [sections, setSections] = useState<BookSection[]>([]);
  const [loading, setLoading] = useState(false);
  /** 最後にフェッチした内容キー（episodeId:updatedAt 列）。一致時は再取得しない */
  const lastFetchKeyRef = useRef<string | null>(null);

  // ツリーが現在のプロジェクトのものか（空ツリーは判定材料がないので許容）
  const treeProjectId =
    chapterTree?.chapters[0]?.chapter.projectId ?? chapterTree?.ungrouped[0]?.projectId ?? null;
  const treeReady =
    !!chapterTree && (!projectId || treeProjectId === null || treeProjectId === projectId);

  // 総文字数はツリーから同期的に導出（本文フェッチの完了を待たない）
  const totalChars = useMemo(() => {
    if (!treeReady || !chapterTree) return 0;
    let total = 0;
    for (const cw of chapterTree.chapters) {
      for (const ep of cw.episodes) total += ep.charCount;
    }
    for (const ep of chapterTree.ungrouped) total += ep.charCount;
    return total;
  }, [treeReady, chapterTree]);

  useEffect(() => {
    if (!active) {
      // 閉じたら本文を破棄（次回オープン時の旧プロジェクト残留を防ぐ）
      setSections([]);
      setLoading(false);
      lastFetchKeyRef.current = null;
      return;
    }
    if (!chapterTree || !treeReady) {
      // ツリー未取得 or 別プロジェクトの旧ツリー → 読込中として待つ
      setSections([]);
      setLoading(true);
      lastFetchKeyRef.current = null;
      return;
    }

    // 読み順にエピソードを収集しつつ、章扉の挿入位置を記録する
    interface PlacedEpisode {
      episodeId: string;
      chapterId: string | null;
      title: string;
      updatedAt: string;
    }
    const placed: PlacedEpisode[] = [];
    // chapterId -> 章扉メタ
    const coverBefore = new Map<string, CoverSection>();

    for (const cw of chapterTree.chapters) {
      const firstEp = cw.episodes[0]?.id ?? null;
      coverBefore.set(cw.chapter.id, {
        kind: 'cover',
        chapterId: cw.chapter.id,
        title: cw.chapter.title,
        mood: cw.chapter.mood ?? '',
        summary: cw.chapter.summary ?? '',
        firstEpisodeId: firstEp,
      });
      for (const ep of cw.episodes) {
        placed.push({ episodeId: ep.id, chapterId: cw.chapter.id, title: ep.title, updatedAt: ep.updatedAt });
      }
    }
    // 章に属さないエピソードは末尾に置く（章扉なし）
    for (const ep of chapterTree.ungrouped) {
      placed.push({ episodeId: ep.id, chapterId: null, title: ep.title, updatedAt: ep.updatedAt });
    }

    // 本文が変わりうる変更（ID列・更新時刻）だけに反応する
    const fetchKey = placed.map((p) => `${p.episodeId}:${p.updatedAt}`).join('|');
    if (fetchKey === lastFetchKeyRef.current) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    // 各エピソード本文を並列取得し、取得時に一度だけサニタイズする
    void Promise.all(
      placed.map((p) =>
        invoke<unknown>('get_episode', { id: p.episodeId })
          .then((raw) => dotenToRuby(sanitizeHtml(toCamelCase<Episode>(raw).body ?? '')))
          .catch(() => ''),
      ),
    ).then((bodies) => {
      if (cancelled) return;
      lastFetchKeyRef.current = fetchKey;
      const result: BookSection[] = [];
      let lastChapterId: string | null | undefined;
      placed.forEach((p, i) => {
        // 章が切り替わったら章扉を挿入
        if (p.chapterId && p.chapterId !== lastChapterId) {
          const cover = coverBefore.get(p.chapterId);
          if (cover) result.push(cover);
        }
        lastChapterId = p.chapterId;
        result.push({
          kind: 'episode',
          episodeId: p.episodeId,
          chapterId: p.chapterId,
          title: p.title,
          html: bodies[i],
        });
      });
      setSections(result);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [active, chapterTree, treeReady]);

  return { sections, loading, totalChars };
}

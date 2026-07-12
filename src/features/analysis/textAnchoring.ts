import type { Editor } from '@tiptap/react';

/**
 * 本文HTML→平文変換とAI指摘箇所へのジャンプ（ProofreadPanel / ReaderReactionsPanel 共用）。
 * AIが返す逐語引用フレーズを平文オフセットへ解決し、SearchAndReplace 拡張で
 * ProseMirror 位置に変換してエディタ内の該当箇所へジャンプする。
 */

/** Rust の strip_html_to_plain と同一ロジック：</p> </div> </li> <br> を \n に変換 */
export function stripHtml(html: string): string {
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

/**
 * 平文オフセットからエディタの該当箇所にジャンプする。
 * 検索ハイライト（setSearchTerm）を利用するため、パネルを閉じる際は
 * `editor.commands.setSearchTerm('')` でハイライトを解除すること。
 */
export function jumpToPlainOffset(
  editor: Editor,
  plainText: string,
  offset: number,
  length: number,
): void {
  if (length === 0 || offset < 0) return;

  let matched = plainText.slice(offset, offset + length);
  if (matched.length === 0) return;

  // 改行を含む場合（長文・読点過多など）は最初の空でない行を検索ワードに使用
  let searchOffset = offset;
  if (matched.includes('\n')) {
    const firstLine = matched.split('\n').find((l) => l.trim().length > 0) ?? '';
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
}

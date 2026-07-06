/**
 * HTML 本文から表示文字数を数える。
 * バックエンドの text_char_count（src-tauri/src/db/mod.rs）と同一仕様を維持すること:
 * - HTMLタグは除去
 * - <rt>〜</rt>（ルビの読み）は文字数に含めない
 * - 改行（\n \r）は文字数に含めない
 */
export function countHtmlChars(html: string): number {
  let count = 0;
  let inTag = false;
  let inRt = false;
  let tagBuf = '';
  for (const ch of html) {
    if (ch === '<') {
      inTag = true;
      tagBuf = '';
      continue;
    }
    if (ch === '>' && inTag) {
      inTag = false;
      const tag = tagBuf.trim().toLowerCase();
      if (tag === 'rt' || tag.startsWith('rt ')) inRt = true;
      else if (tag === '/rt') inRt = false;
      continue;
    }
    if (inTag) {
      tagBuf += ch;
      continue;
    }
    if (!inRt && ch !== '\n' && ch !== '\r') count++;
  }
  return count;
}

/**
 * 縦中横（tate-chu-yoko）の対象判定と HTML 変換。
 *
 * 縦書き（writing-mode: vertical-rl）+ text-orientation: mixed では、アラビア数字と
 * ラテン文字が 90° 横倒しになる。これを直立させるため、対象範囲を span/デコレーションで
 * 囲み CSS の `text-combine-upright: all` を当てる（Chromium/WebView2 は `digits N` 自動値
 * 未対応のため、範囲を明示的に囲むのが唯一確実な方法）。
 *
 * このモジュールは「どの範囲を縦中横にするか」の唯一の真実。読書モード（HTML 文字列変換）と
 * エディタ（ProseMirror デコレーション）の両方がここを参照し、同じ本文が両者で異なって
 * 描画されるのを防ぐ。
 *
 * ルール（同一種の連続＝最大ランで判定）:
 * - 数字: [0-9] の長さ 1〜3 のラン（1 桁＝直立のみ、2〜3 桁＝1 マスに結合）。
 *   4 桁以上は横にはみ出し隣列へ食い込むため対象外（横倒しのまま）。
 * - 大文字略語: [A-Z] の長さ 2〜4 のラン（AI/DNA/OK 等）。
 *   1 文字や 5 文字以上、小文字を含む語は対象外（長い英単語は横組みが正道）。
 */

/** 縦中横にすべき文字範囲 [start, end)（end は排他） */
export type TcyRange = [start: number, end: number];

/**
 * テキスト内で縦中横にすべき範囲を返す。
 * 数字・英字それぞれの最大ランを取り出し、長さ条件で採否を決める
 * （最大ランで判定するため、4桁以上の数字や5文字以上の大文字略語には一致しない）。
 */
export function matchTcyRuns(text: string): TcyRange[] {
  const ranges: TcyRange[] = [];
  // 数字ランは「その直前が数字でない」かつ「長さ1〜3」かつ「直後が数字でない」ものだけを採る。
  // 大文字ランは「英数字に挟まれていない」長さ2〜4のもの。
  const re = /(\d+)|([A-Za-z]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    const token = m[0];
    if (m[1] !== undefined) {
      // 数字ラン: 長さ1〜3のときのみ縦中横（4桁以上は横倒しのまま）
      if (token.length <= 3) ranges.push([start, start + token.length]);
    } else {
      // 英字ラン: すべて大文字 かつ 長さ2〜4のときのみ縦中横
      if (token.length >= 2 && token.length <= 4 && /^[A-Z]+$/.test(token)) {
        ranges.push([start, start + token.length]);
      }
    }
  }
  return ranges;
}

/**
 * HTML 文字列内のテキストノードを走査し、縦中横対象範囲を
 * <span class="tcy"> で囲んだ HTML を返す（DOM を使うためブラウザ環境専用）。
 * dotenToRuby と同じ手法。既存のマークアップ（ルビ・傍点等）は保持する。
 */
export function wrapTcyHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    textNodes.push(node as Text);
    node = walker.nextNode();
  }
  for (const tn of textNodes) {
    const text = tn.textContent ?? '';
    const ranges = matchTcyRuns(text);
    if (ranges.length === 0) continue;
    const frag = document.createDocumentFragment();
    let cursor = 0;
    for (const [start, end] of ranges) {
      if (start > cursor) frag.append(text.slice(cursor, start));
      const span = document.createElement('span');
      span.className = 'tcy';
      span.textContent = text.slice(start, end);
      frag.appendChild(span);
      cursor = end;
    }
    if (cursor < text.length) frag.append(text.slice(cursor));
    tn.replaceWith(frag);
  }
  return div.innerHTML;
}

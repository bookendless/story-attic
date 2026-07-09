import DOMPurify from 'dompurify';

/**
 * エピソード本文 HTML の共有サニタイザ。
 * ルビ（<ruby>/<rt>）・傍点（span.doten）等の表示用マークアップは保持する。
 * プレビュー・読書モードなど本文を dangerouslySetInnerHTML で描画する箇所は
 * 必ずこの関数を経由し、サニタイズ強度を一元管理する。
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form', 'script', 'base', 'link'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onfocus', 'onblur'],
  });
}

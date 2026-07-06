import { describe, it, expect } from 'vitest';
import { countHtmlChars } from './charCount';

describe('countHtmlChars', () => {
  it('プレーンな段落の文字数を数える', () => {
    expect(countHtmlChars('<p>あいうえお</p>')).toBe(5);
  });

  it('HTMLタグ自体は文字数に含めない', () => {
    expect(countHtmlChars('<p><strong>強調</strong>テキスト</p>')).toBe(6);
  });

  it('改行（段落区切り）は文字数に含めない', () => {
    expect(countHtmlChars('<p>一行目</p>\n<p>二行目</p>')).toBe(6);
  });

  it('ルビの本文は数え、読み(rt)は数えない', () => {
    // 漢字(2) + 、(1) = 3。「かんじ」は読みなので除外
    expect(countHtmlChars('<p><ruby>漢字<rt>かんじ</rt></ruby>、</p>')).toBe(3);
  });

  it('rt に属性が付いていても除外できる', () => {
    expect(countHtmlChars('<ruby>山<rt lang="ja">やま</rt></ruby>')).toBe(1);
  });

  it('空文字は0', () => {
    expect(countHtmlChars('')).toBe(0);
  });
});

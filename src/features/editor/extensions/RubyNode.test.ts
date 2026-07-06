import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import { RubyNode } from './RubyNode';

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

function createEditor(content: string): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({ heading: false, blockquote: false, codeBlock: false, code: false, horizontalRule: false }),
      RubyNode,
    ],
    content,
  });
}

describe('RubyNode', () => {
  it('getText() にルビの本文（漢字部分）が含まれる', () => {
    editor = createEditor('<p><ruby>漢字<rt>かんじ</rt></ruby></p>');
    // renderText により本文「漢字」が抽出される
    expect(editor.getText()).toContain('漢字');
  });

  it('getText() にルビの読み（rt）は含まれない', () => {
    editor = createEditor('<p><ruby>漢字<rt>かんじ</rt></ruby></p>');
    expect(editor.getText()).not.toContain('かんじ');
  });

  it('通常テキストとルビが混在してもカウント漏れしない', () => {
    editor = createEditor('<p>山田<ruby>太郎<rt>たろう</rt></ruby></p>');
    const text = editor.getText();
    expect(text).toContain('山田');
    expect(text).toContain('太郎');
    expect(text).not.toContain('たろう');
  });
});

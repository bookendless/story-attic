import { Extension } from '@tiptap/core';

/**
 * 自動字下げ拡張
 * Enter後の段落先頭に全角スペースを挿入する
 */
export const AutoIndent = Extension.create({
  name: 'autoIndent',

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { state } = this.editor.view;
        const { selection } = state;
        const { $from } = selection;

        // 段落の先頭にいる場合は字下げしない
        if ($from.parentOffset === 0) return false;

        // デフォルトのEnterを実行した後、全角スペースを挿入
        this.editor.commands.splitBlock();
        this.editor.commands.insertContent('　'); // 全角スペース
        return true;
      },
    };
  },
});

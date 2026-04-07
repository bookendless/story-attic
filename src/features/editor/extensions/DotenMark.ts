import { Mark, mergeAttributes } from '@tiptap/core';

/**
 * 傍点Mark
 * text-emphasis CSS を使用して傍点を表示する
 */
export const DotenMark = Mark.create({
  name: 'doten',

  parseHTML() {
    return [
      { tag: 'span.doten' },
      { style: 'text-emphasis', consuming: false },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'doten' }), 0];
  },

  addCommands() {
    return {
      toggleDoten:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    };
  },
});

// TypeScriptの型拡張
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    doten: {
      toggleDoten: () => ReturnType;
    };
  }
}

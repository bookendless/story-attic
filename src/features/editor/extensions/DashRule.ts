import { Extension, InputRule } from '@tiptap/core';

/**
 * ダッシュ自動変換
 * --- → ――（二重ダッシュ）
 */
export const DashRule = Extension.create({
  name: 'dashRule',

  addInputRules() {
    return [
      new InputRule({
        find: /---$/,
        handler: ({ state, range }) => {
          const { tr } = state;
          tr.replaceWith(range.from, range.to, state.schema.text('――'));
        },
      }),
    ];
  },
});

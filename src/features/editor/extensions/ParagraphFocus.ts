import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * 段落フォーカス拡張
 * カーソルがある段落以外のトップレベルブロックに paragraph-dimmed クラスを付与する。
 * 淡色化の適用はコンテナ側の .paragraph-focus-on クラスでCSS的に制御する。
 */
export const ParagraphFocus = Extension.create({
  name: 'paragraphFocus',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('paragraphFocus'),
        props: {
          decorations(state) {
            const { doc, selection } = state;
            const decorations: Decoration[] = [];
            doc.forEach((node, offset) => {
              const containsCursor =
                selection.head >= offset && selection.head <= offset + node.nodeSize;
              if (!containsCursor) {
                decorations.push(
                  Decoration.node(offset, offset + node.nodeSize, { class: 'paragraph-dimmed' }),
                );
              }
            });
            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});

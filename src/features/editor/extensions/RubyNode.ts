import { Node, mergeAttributes, InputRule } from '@tiptap/core';

/**
 * ルビNode
 * 記法: |漢字《かんじ》 → <ruby>漢字<rt>かんじ</rt></ruby>
 */
export const RubyNode = Node.create({
  name: 'ruby',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      text: { default: '' },
      ruby: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'ruby',
        getAttrs: (node) => {
          const el = node as HTMLElement;
          const rt = el.querySelector('rt');
          const text = el.childNodes[0]?.textContent ?? '';
          return { text, ruby: rt?.textContent ?? '' };
        },
      },
    ];
  },

  // getText() にルビの本文（漢字部分）を含める。読み（rt）は含めない
  renderText({ node }) {
    return (node.attrs.text as string) ?? '';
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'ruby',
      mergeAttributes(HTMLAttributes),
      node.attrs.text,
      ['rt', {}, node.attrs.ruby],
    ];
  },

  addInputRules() {
    return [
      // |漢字《かんじ》 → rubyノード
      new InputRule({
        find: /\|([^|《]+)《([^》]+)》$/,
        handler: ({ state, range, match }) => {
          const [, text, ruby] = match;
          const { tr } = state;
          tr.replaceWith(range.from, range.to, this.type.create({ text, ruby }));
        },
      }),
    ];
  },
});

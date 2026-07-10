import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { matchTcyRuns } from '@/shared/utils/tateChuYoko';

/**
 * 縦中横（tate-chu-yoko）拡張
 *
 * 縦書きで横倒しになる数字・大文字略語を直立表示させるため、対象範囲へ
 * `tcy` クラスのインラインデコレーションを付与する（判定は共有の matchTcyRuns。
 * 読書モードと同一ルール）。実際の縦中横効果は CSS 側で
 * `.editor-tategaki.tcy-on .tcy { text-combine-upright: all }` として当てる。
 *
 * デコレーションは非破壊（本文には手を加えない）。CSS が無ければ不可視なので、
 * 拡張は常時登録し、ON/OFF はコンテナの `tcy-on` クラス切替で即時反映する
 * （拡張配列でゲートするとエディタ再生成まで効かないため）。
 */
export const TateChuYoko = Extension.create({
  name: 'tateChuYoko',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('tateChuYoko'),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;
              for (const [start, end] of matchTcyRuns(node.text)) {
                decorations.push(
                  Decoration.inline(pos + start, pos + end, { class: 'tcy' }),
                );
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

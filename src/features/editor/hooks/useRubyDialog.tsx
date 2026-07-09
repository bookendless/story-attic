import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { RubyDialog } from '../components/RubyDialog';

/**
 * ルビ入力ダイアログの状態管理。
 * ツールバー・右クリックメニューの双方から同じロジックで「選択テキストへルビを設定」を呼び出せるようにする。
 */
export function useRubyDialog(editor: Editor) {
  const [visible, setVisible] = useState(false);
  const [selectedText, setSelectedText] = useState('');

  const openRubyDialog = () => {
    const { from, to, empty } = editor.state.selection;
    if (empty) return;
    setSelectedText(editor.state.doc.textBetween(from, to, ''));
    setVisible(true);
  };

  const handleConfirm = (ruby: string) => {
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, '');
    editor
      .chain()
      .focus()
      .deleteRange({ from, to })
      .insertContent({
        type: 'ruby',
        attrs: { text, ruby },
      })
      .run();
    setVisible(false);
  };

  const dialog = visible ? (
    <RubyDialog
      selectedText={selectedText}
      onConfirm={handleConfirm}
      onClose={() => setVisible(false)}
    />
  ) : null;

  return { openRubyDialog, dialog };
}

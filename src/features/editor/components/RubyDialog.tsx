import { useState, useRef, useEffect } from 'react';

interface RubyDialogProps {
  selectedText: string;
  onConfirm: (ruby: string) => void;
  onClose: () => void;
}

export function RubyDialog({ selectedText, onConfirm, onClose }: RubyDialogProps) {
  const [ruby, setRuby] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ minWidth: '320px' }}>
        <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text)' }}>
          ルビを設定
        </h3>
        <div className="mb-3">
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>対象テキスト</p>
          <div
            className="px-3 py-2 rounded text-sm"
            style={{
              background: 'var(--bg-deep)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontFamily: 'var(--font-editor)',
            }}
          >
            {selectedText || '（テキストが選択されていません）'}
          </div>
        </div>
        <div className="mb-4">
          <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>
            読み（ふりがな）
          </label>
          <input
            ref={inputRef}
            className="input text-sm"
            placeholder="例：かんじ"
            value={ruby}
            onChange={(e) => setRuby(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && ruby.trim() && selectedText) onConfirm(ruby.trim());
              if (e.key === 'Escape') onClose();
            }}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost text-xs" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="btn btn-primary text-xs"
            onClick={() => ruby.trim() && selectedText && onConfirm(ruby.trim())}
            disabled={!ruby.trim() || !selectedText}
          >
            適用
          </button>
        </div>
      </div>
    </div>
  );
}

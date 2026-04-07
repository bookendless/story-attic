import { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '@/shared/stores/projectStore';

interface Props {
  onCreated: (id: string) => void;
}

export function NewProjectCard({ onCreated }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const createProject = useProjectStore((s) => s.createProject);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleCreate = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setIsCreating(true);
    try {
      const id = await createProject(trimmed);
      setTitle('');
      setIsOpen(false);
      onCreated(id);
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') {
      setTitle('');
      setIsOpen(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        className="new-card flex flex-col items-center justify-center p-5 h-[168px] cursor-pointer"
        onClick={() => setIsOpen(true)}
      >
        <span
          className="text-3xl mb-3 transition-transform duration-300"
          style={{ color: 'var(--text-muted)' }}
        >
          ＋
        </span>
        <span
          className="text-sm tracking-wider"
          style={{
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-heading)',
          }}
        >
          新しい物語を始める
        </span>
      </button>
    );
  }

  return (
    <div
      className="card flex flex-col p-5"
      style={{ borderColor: 'var(--accent)' }}
    >
      <p
        className="text-xs mb-3 tracking-wider"
        style={{
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-heading)',
        }}
      >
        作品タイトルを入力
      </p>
      <input
        ref={inputRef}
        className="input mb-4"
        placeholder="タイトル"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={100}
        disabled={isCreating}
      />
      <div className="flex gap-2 justify-end">
        <button
          className="btn btn-ghost text-xs"
          onClick={() => {
            setTitle('');
            setIsOpen(false);
          }}
          disabled={isCreating}
        >
          キャンセル
        </button>
        <button
          className="btn btn-primary text-xs"
          onClick={handleCreate}
          disabled={!title.trim() || isCreating}
        >
          作成
        </button>
      </div>
    </div>
  );
}

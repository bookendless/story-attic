import type { ProjectSummary } from '@/shared/types';

interface Props {
  project: ProjectSummary;
  onOpen: () => void;
  onDelete: () => void;
}

export function ProjectCard({ project, onOpen, onDelete }: Props) {
  const updatedDate = new Date(project.updatedAt).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const totalCharsDisplay =
    project.totalChars >= 10000
      ? `${(project.totalChars / 10000).toFixed(1)}万字`
      : `${project.totalChars.toLocaleString()}字`;

  return (
    <div
      className="card group relative flex flex-col cursor-pointer p-5"
      onClick={onOpen}
    >
      {/* 削除ボタン（ホバー時に表示） */}
      <button
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-200 w-7 h-7 rounded-md flex items-center justify-center text-xs"
        style={{
          color: 'var(--text-muted)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
        }}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="削除"
        aria-label="作品を削除"
      >
        ×
      </button>

      {/* 作品タイトル */}
      <h3
        className="text-base font-medium mb-1 pr-6 leading-snug"
        style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}
      >
        {project.title}
      </h3>

      {/* 著者名 */}
      {project.author && (
        <p
          className="text-xs mb-3"
          style={{
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-heading)',
            letterSpacing: '0.05em',
          }}
        >
          {project.author}
        </p>
      )}

      {/* 説明文 */}
      {project.description && (
        <p
          className="text-xs mb-4 flex-1 line-clamp-2 leading-relaxed"
          style={{ color: 'var(--text-mid)' }}
        >
          {project.description}
        </p>
      )}

      {/* フッター情報 */}
      <div
        className="mt-auto pt-3 flex items-end justify-between border-t"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1">
            <span style={{ opacity: 0.6 }}>◇</span>
            {project.episodeCount}話
          </span>
          <span className="flex items-center gap-1">
            <span style={{ opacity: 0.6 }}>◇</span>
            {totalCharsDisplay}
          </span>
        </div>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {updatedDate}
        </span>
      </div>
    </div>
  );
}

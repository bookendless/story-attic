import { useToastStore, type ToastItem, type ToastType } from '@/shared/stores/toastStore';

const ACCENT_COLORS: Record<ToastType, string> = {
  error: 'var(--danger)',
  success: 'var(--success)',
  info: 'var(--accent)',
};

const ICONS: Record<ToastType, string> = {
  error: '⚠',
  success: '✓',
  info: 'ℹ',
};

function ToastCard({ toast }: { toast: ToastItem }) {
  const dismissToast = useToastStore((s) => s.dismissToast);

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '10px 12px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-light)',
        borderLeft: `3px solid ${ACCENT_COLORS[toast.type]}`,
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        fontSize: '12px',
        color: 'var(--text)',
        maxWidth: '360px',
      }}
    >
      <span style={{ color: ACCENT_COLORS[toast.type], fontSize: '13px', lineHeight: '1.4' }} aria-hidden="true">
        {ICONS[toast.type]}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ lineHeight: '1.5', wordBreak: 'break-word' }}>{toast.message}</p>
        {toast.action && (
          <button
            className="btn btn-ghost text-xs"
            style={{ padding: '2px 8px', marginTop: '6px', color: 'var(--accent)' }}
            onClick={() => {
              dismissToast(toast.id);
              toast.action?.run();
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        aria-label="通知を閉じる"
        onClick={() => dismissToast(toast.id)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          fontSize: '13px',
          lineHeight: 1,
          padding: '2px',
        }}
      >
        ✕
      </button>
    </div>
  );
}

/** アプリ全体のトースト表示コンテナ（App 直下に1つ配置する） */
export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '44px',
        right: '16px',
        zIndex: 300,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>
  );
}

import { Component, type ReactNode } from 'react';
import { useEditorStore } from '@/shared/stores/editorStore';

interface Props {
  children: ReactNode;
  /** 'app': 全画面フォールバック / 'panel': 領域内フォールバック */
  variant?: 'app' | 'panel';
  /** パネル用フォールバックの見出しに使う表示名 */
  name?: string;
}

interface State {
  error: Error | null;
}

/**
 * 未保存の本文を localStorage に退避する（クラッシュ時の原稿ロスト防止）。
 * 退避キー: story-attic-rescue-{episodeId}
 */
function rescueUnsavedBody() {
  try {
    const { currentEpisode, isDirty } = useEditorStore.getState();
    if (currentEpisode && isDirty) {
      localStorage.setItem(
        `story-attic-rescue-${currentEpisode.id}`,
        JSON.stringify({ savedAt: new Date().toISOString(), body: currentEpisode.body }),
      );
    }
  } catch {
    // 退避自体の失敗はこれ以上打つ手がない
  }
}

/**
 * ErrorBoundary。
 * variant='app' はアプリルート用（白画面防止 + 本文退避 + 再読み込み）、
 * variant='panel' はパネル単位用（throw したパネルがエディタを道連れにしない）。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    rescueUnsavedBody();
    console.error('[ErrorBoundary]', this.props.name ?? 'app', error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.variant === 'panel') {
      return (
        <div
          role="alert"
          style={{
            padding: '16px',
            fontSize: '12px',
            color: 'var(--text-mid)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <p style={{ color: 'var(--danger)', fontWeight: 600 }}>
            {this.props.name ?? 'このパネル'}でエラーが発生しました
          </p>
          <p style={{ color: 'var(--text-muted)', wordBreak: 'break-word' }}>{error.message}</p>
          <button
            className="btn btn-ghost text-xs"
            style={{ alignSelf: 'flex-start', padding: '4px 12px' }}
            onClick={() => this.setState({ error: null })}
          >
            再試行
          </button>
        </div>
      );
    }

    // アプリ全体のフォールバック
    return (
      <div
        role="alert"
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '14px',
          background: 'var(--bg, #1a1a1e)',
          color: 'var(--text, #e8e8e8)',
          padding: '32px',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: '16px', fontWeight: 600 }}>予期しないエラーが発生しました</p>
        <p style={{ fontSize: '12px', color: 'var(--text-muted, #888)', maxWidth: '480px', wordBreak: 'break-word' }}>
          {error.message}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-muted, #888)' }}>
          未保存の本文はローカルに退避済みです。再読み込みで作業を再開できます。
        </p>
        <button
          className="btn btn-primary"
          style={{ padding: '6px 20px' }}
          onClick={() => window.location.reload()}
        >
          再読み込み
        </button>
      </div>
    );
  }
}

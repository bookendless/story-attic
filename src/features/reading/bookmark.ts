/**
 * 読書モードのしおり永続化
 *
 * 「前回どこまで読んだか」をプロジェクトごとに localStorage へ保存する。
 * projectId → episodeId のマップ1件で全プロジェクト分を保持し、
 * 別プロジェクトで読書しても他プロジェクトのしおりを消さない。
 * ページ番号はフォント設定やウィンドウ幅で変動するため、
 * 復元の基準はエピソード単位（安定した粒度）とする。
 */

const KEY = 'story-attic-reading-bookmarks';

export interface ReadingBookmark {
  projectId: string;
  /** 最後に読んでいたセクションのエピソードID（章扉の場合はその章の先頭エピソードID） */
  episodeId: string;
}

/** projectId → episodeId のマップを localStorage から読む */
function loadMap(): Record<string, string> {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
    }
  } catch {
    /* 無視 */
  }
  return {};
}

/** 指定プロジェクトのしおりを取得（無ければ null） */
export function loadBookmark(projectId: string): ReadingBookmark | null {
  const episodeId = loadMap()[projectId];
  return typeof episodeId === 'string' && episodeId ? { projectId, episodeId } : null;
}

/** しおりを保存する（該当プロジェクトの分だけ上書き） */
export function saveBookmark(bookmark: ReadingBookmark): void {
  try {
    const map = loadMap();
    map[bookmark.projectId] = bookmark.episodeId;
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* 無視 */
  }
}

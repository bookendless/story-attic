/**
 * セッション再開情報の永続化（localStorage）
 * プロジェクトごとに「最後に編集していたエピソード・カーソル位置・執筆量・次回へのメモ」を保持し、
 * 次回起動時の「おかえり」再開体験（ResumeCard・カーソル復元）に利用する。
 */

export interface ResumeInfo {
  /** 最後に編集していたエピソードID */
  episodeId: string | null;
  /** エピソードごとのカーソル位置（ProseMirrorのdoc位置） */
  positions: Record<string, number>;
  /** 最終アクティビティ時刻（ISO文字列） */
  savedAt: string;
  /** 最終アクティビティ日の執筆字数 */
  writtenChars: number;
  /** 次のセッションの自分へのメモ */
  note: string;
}

type ResumeMap = Record<string, ResumeInfo>;

const STORAGE_KEY = 'story-attic-resume';

function emptyInfo(): ResumeInfo {
  return { episodeId: null, positions: {}, savedAt: new Date().toISOString(), writtenChars: 0, note: '' };
}

function loadMap(): ResumeMap {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') return parsed as ResumeMap;
    }
  } catch { /* 無視 */ }
  return {};
}

function saveMap(map: ResumeMap) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch { /* 無視 */ }
}

/** プロジェクトの再開情報を取得（未保存ならnull） */
export function getResumeInfo(projectId: string): ResumeInfo | null {
  return loadMap()[projectId] ?? null;
}

/** カーソル位置を保存（最終エピソード・最終時刻も同時に更新） */
export function saveCursorPosition(projectId: string, episodeId: string, pos: number) {
  const map = loadMap();
  const info = map[projectId] ?? emptyInfo();
  info.positions = { ...info.positions, [episodeId]: pos };
  info.episodeId = episodeId;
  info.savedAt = new Date().toISOString();
  map[projectId] = info;
  saveMap(map);
}

/** 保存済みカーソル位置を取得（未保存ならnull） */
export function getCursorPosition(projectId: string, episodeId: string): number | null {
  const pos = loadMap()[projectId]?.positions?.[episodeId];
  return typeof pos === 'number' && pos >= 0 ? pos : null;
}

/** 執筆アクティビティ（最終エピソード・今日の執筆量・時刻）を記録 */
export function saveResumeActivity(projectId: string, episodeId: string, writtenChars: number) {
  const map = loadMap();
  const info = map[projectId] ?? emptyInfo();
  info.episodeId = episodeId;
  info.writtenChars = writtenChars;
  info.savedAt = new Date().toISOString();
  map[projectId] = info;
  saveMap(map);
}

/** 次のセッションへのメモを保存 */
export function saveResumeNote(projectId: string, note: string) {
  const map = loadMap();
  const info = map[projectId] ?? emptyInfo();
  info.note = note;
  map[projectId] = info;
  saveMap(map);
}

/** メモをクリア（再開カードで一度表示した後に呼ぶ） */
export function clearResumeNote(projectId: string) {
  const map = loadMap();
  if (!map[projectId]?.note) return;
  map[projectId] = { ...map[projectId], note: '' };
  saveMap(map);
}

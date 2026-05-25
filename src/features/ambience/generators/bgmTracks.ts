/**
 * BGM（環境音）トラック定義
 * public/bgm/ にバンドルされた音源を固定リストで登録する。
 * 曲を追加する場合はファイルを public/bgm/ に置き、ここへ1エントリ追加する。
 */

export interface BgmTrack {
  /** 内部ID（localStorage 永続化キー・URL非依存の識別子） */
  id: string;
  /** UI 表示名 */
  label: string;
  /** 音源URL（dist ルートからの絶対パス） */
  src: string;
}

export const BGM_TRACKS: BgmTrack[] = [
  { id: 'ambient-symphony', label: 'アンビエント・シンフォニー', src: '/bgm/ambient-symphony.mp3' },
  { id: 'cafe-jazz-piano',  label: 'カフェ・ジャズピアノ',       src: '/bgm/cafe-jazz-piano.mp3' },
];

/** ID からトラックを取得（無ければ undefined） */
export function findBgmTrack(id: string | null): BgmTrack | undefined {
  if (!id) return undefined;
  return BGM_TRACKS.find((t) => t.id === id);
}

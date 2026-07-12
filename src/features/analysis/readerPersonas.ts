/**
 * AI読者ライブ反応のペルソナ定義。
 * ペルソナIDと人格プロンプトの対応は Rust 側
 * `src-tauri/src/commands/ai.rs` の `reaction_persona_prompt` と一致させること。
 */

export interface ReaderPersonaMeta {
  id: string;
  name: string;
  icon: string;
  /** カードのアクセント色（CSS カラー値） */
  color: string;
  desc: string;
}

export const READER_PERSONAS: ReaderPersonaMeta[] = [
  { id: 'light_novel', name: 'ラノベ好き高校生', icon: '🎒', color: '#e8a33d', desc: 'テンポと勢い重視。熱い展開に全力で盛り上がる' },
  { id: 'mystery',     name: 'ミステリーマニア', icon: '🔍', color: '#7c9fd4', desc: '伏線と違和感を見逃さず、常に真相を予想する' },
  { id: 'editor',      name: '辛口編集者',       icon: '✒️', color: '#c4696e', desc: '離脱ポイント・引きの弱さに遠慮なく反応する' },
  { id: 'romance',     name: '恋愛小説ファン',   icon: '💐', color: '#d48bb0', desc: '感情の機微と関係性の変化に敏感' },
  { id: 'literary',    name: '純文学好き',       icon: '📖', color: '#8fac7e', desc: '文体と言葉選びをゆっくり味わう' },
  { id: 'casual',      name: 'ライト読者',       icon: '📱', color: '#9d9488', desc: '通勤中にスマホで読む。飽きたら離脱する' },
];

export const DEFAULT_SELECTED_PERSONAS = ['light_novel', 'mystery', 'editor'];

/** 同時に選択できる読者数 */
export const MAX_SELECTED_PERSONAS = 3;

export function getPersonaMeta(id: string): ReaderPersonaMeta {
  return READER_PERSONAS.find((p) => p.id === id) ?? READER_PERSONAS[READER_PERSONAS.length - 1];
}

const STORAGE_KEY = 'story-attic-reader-reaction-personas';

export function loadSelectedPersonas(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const valid = parsed.filter(
          (id): id is string => typeof id === 'string' && READER_PERSONAS.some((p) => p.id === id),
        );
        if (valid.length > 0) return valid.slice(0, MAX_SELECTED_PERSONAS);
      }
    }
  } catch { /* 無視 */ }
  return [...DEFAULT_SELECTED_PERSONAS];
}

export function saveSelectedPersonas(ids: string[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch { /* 無視 */ }
}

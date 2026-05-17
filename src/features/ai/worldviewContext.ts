/**
 * AI校正用の世界観コンテキスト組み立て
 *
 * プロット構造（テーマ・舞台・Creative Core）＋世界観マテリアル＋主要キャラ名を
 * 1つのテキストに集約し、AIがクリシェの代替表現を「作品の世界観」に沿って提案できるようにする。
 */

import { invoke } from '@tauri-apps/api/core';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import type {
  PlotStructure, PlotStructureData,
  Material, MaterialData,
  Character,
} from '@/shared/types';

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…（省略）' : text;
}

/**
 * プロジェクトの世界観コンテキストを組み立てる。
 * 各情報の取得失敗はそのセクションをスキップするのみで、全体は継続する。
 */
export async function buildWorldviewContext(projectId: string): Promise<string> {
  const parts: string[] = [];

  // 作品の核（テーマ・舞台・Creative Core）
  try {
    const raw = await invoke<unknown>('get_plot_structure', { projectId });
    const ps = toCamelCase<PlotStructure>(raw);
    let data: Partial<PlotStructureData> = {};
    try { data = JSON.parse(ps.data || '{}'); } catch { /* パース失敗は無視 */ }
    const lines: string[] = [];
    if (data.theme) lines.push(`テーマ: ${data.theme}`);
    if (data.centralEmotion) lines.push(`中心感情: ${data.centralEmotion}`);
    if (data.coreQuestion) lines.push(`作品の問い: ${data.coreQuestion}`);
    if (data.setting) lines.push(`舞台設定: ${data.setting}`);
    if (data.structureType) lines.push(`構造タイプ: ${data.structureType}`);
    if (lines.length > 0) parts.push(`【作品の核】\n${lines.join('\n')}`);
  } catch { /* 取得失敗は無視 */ }

  // 世界観マテリアル
  try {
    const raw = await invoke<unknown[]>('get_materials', { projectId });
    const materials = toCamelCase<Material[]>(raw);
    const text = materials
      .filter((m) => m.category === '世界観' || m.book === '世界観設定' || m.book === '世界観')
      .map((m) => {
        let d: Partial<MaterialData> = {};
        try { d = JSON.parse(m.data || '{}'); } catch { /* 無視 */ }
        return `${m.title}: ${d.content || ''}`.trim();
      })
      .filter((s) => s.length > 0)
      .join('\n');
    if (text) parts.push(`【世界観設定】\n${truncate(text, 1500)}`);
  } catch { /* 取得失敗は無視 */ }

  // 登場人物名
  try {
    const raw = await invoke<unknown[]>('get_characters', { projectId });
    const chars = toCamelCase<Character[]>(raw);
    const names = chars.map((c) => c.name).filter((n) => n.trim().length > 0).slice(0, 20);
    if (names.length > 0) parts.push(`【登場人物】\n${names.join('、')}`);
  } catch { /* 取得失敗は無視 */ }

  return parts.join('\n\n');
}

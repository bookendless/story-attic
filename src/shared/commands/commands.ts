/**
 * コマンドパレット登録コマンド定義
 *
 * 稀にしか使わない機能への統一入口。
 * UI から依存ストアのアクションを受け取り、キーワード検索可能な形で提供する。
 */

import { useUIStore } from '@/shared/stores/uiStore';
import { useEditorStore } from '@/shared/stores/editorStore';
import { useAppStore } from '@/shared/stores/appStore';

export interface Command {
  id: string;
  label: string;
  /** 検索用キーワード (ひらがな・カタカナ・英語を含む) */
  keywords: string;
  /** カテゴリ表示用ラベル */
  group: '執筆' | 'ビュー' | 'パネル' | '設定' | 'ナビゲーション';
  /** ショートカット表示 (省略可) */
  shortcut?: string;
  /** 実行時にアクティブエピソードが必要か */
  requiresEpisode?: boolean;
  run: () => void;
}

/** 現時点で有効なコマンド一覧を取得する */
export function getCommands(): Command[] {
  const ui = useUIStore.getState();
  const editor = useEditorStore.getState();
  const app = useAppStore.getState();

  return [
    // ==================================================
    // 執筆支援
    // ==================================================
    {
      id: 'analysis.open',
      label: '文章分析を開く',
      keywords: 'bunsho analysis ぶんしょうぶんせき 文字数 読みやすさ',
      group: '執筆',
      requiresEpisode: true,
      run: () => ui.toggleAnalysisModal(),
    },
    {
      id: 'proofread.toggle',
      label: '校正ビュー 切替',
      keywords: 'proofread こうせい 誤字',
      group: '執筆',
      requiresEpisode: true,
      run: () =>
        ui.setEditorViewMode(ui.editorViewMode === 'proofread' ? 'editor' : 'proofread'),
    },
    {
      id: 'diff.toggle',
      label: '差分ビュー 切替',
      keywords: 'diff さぶん 差分',
      group: '執筆',
      requiresEpisode: true,
      run: () =>
        ui.setEditorViewMode(ui.editorViewMode === 'diff' ? 'editor' : 'diff'),
    },
    {
      id: 'writing-support.open',
      label: '執筆支援を開く',
      keywords: 'writing support しっぴつ しえん 句読点',
      group: '執筆',
      run: () => ui.toggleWritingSupportModal(),
    },
    {
      id: 'search.toggle',
      label: '検索・置換 切替',
      keywords: 'search replace けんさく ちかん',
      group: '執筆',
      shortcut: 'Ctrl+F',
      run: () => ui.toggleSearchBar(),
    },
    {
      id: 'tategaki.toggle',
      label: '縦書き 切替',
      keywords: 'tategaki たてがき 縦書',
      group: 'ビュー',
      run: () => ui.toggleTategaki(),
    },

    // ==================================================
    // ビューモード
    // ==================================================
    {
      id: 'view.editor',
      label: 'ビュー: エディタ',
      keywords: 'view editor えでぃた',
      group: 'ビュー',
      run: () => ui.setEditorViewMode('editor'),
    },
    {
      id: 'view.dialogue',
      label: 'ビュー: 台詞一覧',
      keywords: 'view dialogue せりふ たいし',
      group: 'ビュー',
      shortcut: 'Ctrl+Shift+L',
      requiresEpisode: true,
      run: () =>
        ui.setEditorViewMode(ui.editorViewMode === 'dialogue' ? 'editor' : 'dialogue'),
    },
    {
      id: 'view.preview',
      label: 'ビュー: プレビュー',
      keywords: 'view preview ぷれびゅー',
      group: 'ビュー',
      shortcut: 'Ctrl+Shift+P',
      requiresEpisode: true,
      run: () =>
        ui.setEditorViewMode(ui.editorViewMode === 'preview' ? 'editor' : 'preview'),
    },
    {
      id: 'view.dual',
      label: 'ビュー: デュアル',
      keywords: 'view dual でゅある 2画面',
      group: 'ビュー',
      shortcut: 'Ctrl+Shift+D',
      requiresEpisode: true,
      run: () =>
        ui.setEditorViewMode(ui.editorViewMode === 'dual' ? 'editor' : 'dual'),
    },

    // ==================================================
    // パネル
    // ==================================================
    {
      id: 'panel.toc',
      label: 'パネル: 目次',
      keywords: 'toc mokuji もくじ 目次',
      group: 'パネル',
      run: () => ui.openSidePanelTab('toc'),
    },
    {
      id: 'panel.chapter',
      label: 'パネル: 章立て',
      keywords: 'chapter しょうだて 章 構成',
      group: 'パネル',
      run: () => ui.openSidePanelTab('chapter'),
    },
    {
      id: 'panel.character',
      label: 'パネル: 人物',
      keywords: 'character じんぶつ 人物 キャラ',
      group: 'パネル',
      run: () => ui.openSidePanelTab('character'),
    },
    {
      id: 'panel.plot',
      label: 'パネル: プロット',
      keywords: 'plot ぷろっと',
      group: 'パネル',
      run: () => ui.openSidePanelTab('plot'),
    },
    {
      id: 'panel.synopsis',
      label: 'パネル: あらすじ',
      keywords: 'synopsis あらすじ',
      group: 'パネル',
      run: () => ui.openSidePanelTab('synopsis'),
    },
    {
      id: 'panel.relationship',
      label: 'パネル: 相関図',
      keywords: 'relationship そうかんず 相関 関係',
      group: 'パネル',
      run: () => ui.openSidePanelTab('relationship'),
    },
    {
      id: 'panel.glossary',
      label: 'パネル: 用語',
      keywords: 'glossary ようご 用語',
      group: 'パネル',
      run: () => ui.openSidePanelTab('glossary'),
    },
    {
      id: 'panel.world',
      label: 'パネル: 世界観',
      keywords: 'world せかいかん 世界',
      group: 'パネル',
      run: () => ui.openSidePanelTab('world'),
    },
    {
      id: 'panel.foreshadowing',
      label: 'パネル: 伏線',
      keywords: 'foreshadowing ふくせん 伏線',
      group: 'パネル',
      run: () => ui.openSidePanelTab('foreshadowing'),
    },
    {
      id: 'panel.memo',
      label: 'パネル: メモ',
      keywords: 'memo めも',
      group: 'パネル',
      run: () => ui.openSidePanelTab('memo'),
    },
    {
      id: 'ai.toggle',
      label: 'AIアシスタント 切替',
      keywords: 'ai assistant',
      group: 'パネル',
      shortcut: 'Ctrl+Shift+A',
      run: () => ui.toggleAiPanel(),
    },

    // ==================================================
    // 設定・雰囲気
    // ==================================================
    {
      id: 'settings.open',
      label: '設定を開く',
      keywords: 'settings せってい',
      group: '設定',
      run: () => ui.toggleSettingsModal(),
    },
    {
      id: 'theme.toggle',
      label: 'ライト/ダーク テーマ切替',
      keywords: 'theme light dark てーま',
      group: '設定',
      run: () => ui.toggleTheme(),
    },
    {
      id: 'ambience.open',
      label: '雰囲気設定を開く (演出/サウンド/ゴースト)',
      keywords: 'ambience 雰囲気 演出 サウンド ゴースト effect sound',
      group: '設定',
      run: () => ui.toggleAmbiencePopover(),
    },
    {
      id: 'ambience.toggle',
      label: '演出 ON/OFF',
      keywords: 'ambience effect 雨 雪 桜',
      group: '設定',
      run: () => ui.toggleAmbience(),
    },

    // ==================================================
    // ナビゲーション
    // ==================================================
    {
      id: 'save',
      label: '保存',
      keywords: 'save ほぞん',
      group: 'ナビゲーション',
      shortcut: 'Ctrl+S',
      run: () => { void editor.save(); },
    },
    {
      id: 'home',
      label: 'ホームに戻る',
      keywords: 'home ほーむ',
      group: 'ナビゲーション',
      run: () => app.navigateTo('home'),
    },
  ];
}

/** コマンド検索 (簡易マッチング: label / keywords / id に部分一致) */
export function filterCommands(commands: Command[], query: string): Command[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands;
  return commands.filter((c) => {
    const hay = `${c.label} ${c.keywords} ${c.id}`.toLowerCase();
    return q.split(/\s+/).every((token) => hay.includes(token));
  });
}

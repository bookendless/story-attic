/**
 * アプリ共通SVGアイコン
 * ストローク中心の線画スタイルで統一。currentColorを使用し、親のcolorを継承する。
 */

interface IconProps {
  size?: number;
  className?: string;
}

const defaults = { size: 16 } satisfies IconProps;

/** ホーム（本棚） */
export function IconHome({ size = defaults.size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 8.5V13a1 1 0 001 1h10a1 1 0 001-1V8.5" />
      <path d="M1.5 8.5L8 2.5l6.5 6" />
      <path d="M5.5 14V10a1 1 0 011-1h3a1 1 0 011 1v4" />
    </svg>
  );
}

/** 保存（しおり） */
export function IconSave({ size = defaults.size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 2h8a1 1 0 011 1v11l-4.5-3L4 14V3a1 1 0 011-1z" />
    </svg>
  );
}

/** 検索（虫眼鏡） */
export function IconSearch({ size = defaults.size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  );
}

/** 分析（スパークル／星） */
export function IconAnalysis({ size = defaults.size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3" />
      <path d="M3.8 3.8l2 2M10.2 10.2l2 2M3.8 12.2l2-2M10.2 5.8l2-2" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 校正（チェックマーク付きドキュメント） */
export function IconProofread({ size = defaults.size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 2h6l3 3v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" />
      <path d="M6 9l1.5 1.5L10 7.5" />
    </svg>
  );
}

/** 差分（2枚の紙を重ねたイメージ） */
export function IconDiff({ size = defaults.size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="1.5" y="3" width="8" height="11" rx="1" />
      <path d="M5 3V2.5A1 1 0 016 1.5h5.5a1 1 0 011 1V11a1 1 0 01-1 1H10" />
      <path d="M4 7.5h3M4 10h3" />
    </svg>
  );
}

/** 縦書き（縦線テキスト） */
export function IconTategaki({ size = defaults.size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" className={className}>
      <path d="M11 2.5v11M8 2.5v11M5 2.5v11" />
      <path d="M13 4.5l-2-2" />
    </svg>
  );
}

/** 設定（歯車） */
export function IconSettings({ size = defaults.size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"></path>
    </svg>
  );
}

/** テーマ切替：太陽（ライトモード表示用） */
export function IconSun({ size = defaults.size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.8 3.8l1 1M11.2 11.2l1 1M3.8 12.2l1-1M11.2 4.8l1-1" />
    </svg>
  );
}

/** テーマ切替：月（ダークモード表示用） */
export function IconMoon({ size = defaults.size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M13.5 8.5a5.5 5.5 0 01-7.7 1.3A5.5 5.5 0 017 2.5a5.5 5.5 0 006.5 6z" />
    </svg>
  );
}

/** 雨（雨粒が降るイメージ） */
export function IconRain({ size = defaults.size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 1.5A4 4 0 0012.5 4 3 3 0 0113 10H3A3 3 0 013.5 4a4 4 0 010-.5" />
      <path d="M5 12.5l-.5 2M8 12l-.5 2M11 12.5l-.5 2" />
    </svg>
  );
}

/** 雪（雪の結晶） */
export function IconSnow({ size = defaults.size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 1v14M1 8h14" />
      <path d="M3.8 3.8l2 2M10.2 10.2l2 2M3.8 12.2l2-2M10.2 5.8l2-2" />
      <path d="M6 2l2 1.5L10 2M6 14l2-1.5 2 1.5M2 6l1.5 2L2 10M14 6l-1.5 2L14 10" />
    </svg>
  );
}

/** 桜（花びら） */
export function IconSakura({ size = defaults.size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 3C8 3 6.5 1 5 1.5S3 4 4 5.5" />
      <path d="M8 3C8 3 9.5 1 11 1.5S13 4 12 5.5" />
      <path d="M4 5.5C4 5.5 1.5 5.5 1.5 7.5S4 10.5 5.5 10" />
      <path d="M12 5.5C12 5.5 14.5 5.5 14.5 7.5S12 10.5 10.5 10" />
      <path d="M5.5 10C5.5 10 4.5 12.5 6 14S8 12 8 12" />
      <path d="M10.5 10C10.5 10 11.5 12.5 10 14S8 12 8 12" />
      <circle cx="8" cy="7" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** サウンドON（スピーカー + 音波） */
export function IconSound({ size = defaults.size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 6v4h3l4 3V3L5 6H2z" />
      <path d="M11.5 5.5a3.5 3.5 0 010 5" />
      <path d="M13 4a5.5 5.5 0 010 8" />
    </svg>
  );
}

/** サウンドOFF（スピーカー + ×） */
export function IconSoundOff({ size = defaults.size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 6v4h3l4 3V3L5 6H2z" />
      <path d="M12 5.5l-3 5M9 5.5l3 5" />
    </svg>
  );
}

/** AI チャット（吹き出し + 3点リーダー） */
export function IconAi({ size = defaults.size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 3h12a1 1 0 011 1v6a1 1 0 01-1 1H9l-3 2v-2H2a1 1 0 01-1-1V4a1 1 0 011-1z" />
      <circle cx="5.5" cy="7" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="8" cy="7" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** ゴースト（キャラクターウィジェット） */
export function IconGhost({ size = defaults.size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 9C2 5.134 4.686 2 8 2s6 3.134 6 7v5l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5V9z" />
      <circle cx="6" cy="8.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="8.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** プロット（ツリー構造） */
export function IconPlot({ size = defaults.size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="8" cy="3" r="1.5" />
      <circle cx="4" cy="10" r="1.5" />
      <circle cx="12" cy="10" r="1.5" />
      <path d="M7 4.3L5 8.5M9 4.3L11 8.5" />
    </svg>
  );
}

/** キャラクター（人物シルエット） */
export function IconCharacter({ size = defaults.size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="8" cy="5" r="2.5" />
      <path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" />
    </svg>
  );
}

/** 用語集（辞書・本） */
export function IconGlossary({ size = defaults.size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 2h9a1 1 0 011 1v10a1 1 0 01-1 1H3" />
      <path d="M3 2v12" />
      <path d="M6 5h4M6 8h3" />
    </svg>
  );
}

/** 資料（フォルダツリー） */
export function IconMaterial({ size = defaults.size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 3h4l2 1.5h6a1 1 0 011 1V12a1 1 0 01-1 1H2a1 1 0 01-1-1V4a1 1 0 011-1z" />
      <path d="M5 8h6M5 10.5h4" />
    </svg>
  );
}

/** メモ（付箋） */
export function IconMemo({ size = defaults.size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 2h10a1 1 0 011 1v8l-4 4H3a1 1 0 01-1-1V3a1 1 0 011-1z" />
      <path d="M10 11v4l4-4h-4z" />
      <path d="M5 5.5h6M5 8h4" />
    </svg>
  );
}

/** パネル閉じる（×） */
export function IconClose({ size = defaults.size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

/** 出力・エクスポート（箱から上矢印） */
export function IconExport({ size = defaults.size, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 10V2.5" />
      <path d="M5 5l3-3 3 3" />
      <path d="M2.5 10v3a1 1 0 001 1h9a1 1 0 001-1v-3" />
    </svg>
  );
}

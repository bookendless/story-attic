import type { SettingsCategoryKey } from './types';

// 差分検知対象のキー定義。フラット化した draft オブジェクトのキーと対応する。
// api_key は Keyring 管理なので除外。
export const TAB_KEYS: Record<SettingsCategoryKey, string[]> = {
  writing:   [
    'auto_indent', 'editor_font', 'editor_font_size', 'editor_max_width',
    'chars_per_line', 'lines_per_page', 'show_char_count', 'theme',
  ],
  data:      ['auto_save', 'auto_save_interval_sec'],
  proofread: ['proofread_enabled', 'proofread_categories', 'proofread_popup'],
  ambience:  [
    'effectType', 'density', 'speed', 'angle', 'opacity',
    'sound_enabled', 'masterVolume', 'ambientVolume', 'activeAmbients',
    'typingType', 'typingVolume',
  ],
  ai:        ['provider', 'model', 'system_prompt', 'base_url'],
};

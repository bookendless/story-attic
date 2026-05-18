/**
 * AI パネル（フェーズ駆動レイアウト）共通型
 */
import type { RefObject } from 'react';
import type { AiChatHandle } from './AiChat';

/** 執筆フェーズの AI 呼び出しレベル */
export type WriteLevel = 'silent' | 'mini' | 'open';

/** 各フェーズボディ共通の props */
export interface PhaseBodyProps {
  chatRef: RefObject<AiChatHandle | null>;
  /** AI 応答ストリーミング中。true の間は全セクションを強制折りたたみ */
  isStreaming: boolean;
  /** 執筆フェーズのみ使用 */
  writeLevel: WriteLevel;
}

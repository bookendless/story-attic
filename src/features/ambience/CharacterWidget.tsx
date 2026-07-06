/**
 * ゴーストキャラクターウィジェット
 * ONのとき常時右下に表示。クリックするとつぶやきを表示する。
 * タイピングを再開すると吹き出しだけ消える（ゴーストは残る）。
 * 将来的にはAIと連携して執筆アドバイスを行う予定。
 */

import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/shared/stores/appStore';
import { useEditorStore } from '@/shared/stores/editorStore';
import { useUIStore, type CharacterSettings, type ReaderPersona } from '@/shared/stores/uiStore';
import { onActivity } from '@/shared/utils/idleTracker';
import './characterAnimations.css';

/** つぶやきメッセージ（クリック時にランダム表示） */
const WHISPERS = [
  '今日はどんな物語を書きますか？',
  'ここで一緒に待っていますよ',
  '屋根裏はいつでも静かですね',
  'いい言葉が見つかりますように',
  '続きが楽しみです',
  'ゆっくりと、焦らずに',
  'あなたの物語、素敵ですよ',
  '窓の外は今どんな空ですか？',
  '一文だけ書いてみませんか',
  '…',
  'そっと、そばにいますよ',
];

/** 読者モードのフォールバックメッセージ */
const READER_FALLBACKS = [
  'この場面、ドキドキしながら読みました',
  '続きが気になっています',
  'この先どうなるんでしょう',
  'キャラクターの気持ちが伝わってきます',
  '次の展開を待っています',
];

/** セッション終了時のお祝いメッセージ（+N字 が埋め込まれる） */
const CELEBRATE_WITH_CHARS = [
  'おつかれさま！{chars}字、すてきです',
  '{chars}字も進みましたね。えらい！',
  'いい執筆でした。{chars}字ぶん、物語が育ちましたよ',
];

/** 書けなかったセッションへのねぎらい */
const CELEBRATE_NO_CHARS = [
  'おつかれさま。机に向かえたこと、えらいです',
  '今日も来てくれてうれしいです',
  '考える時間も、大切な執筆時間ですよ',
];

/** 吹き出しが自動で消えるまでの時間（ms） */
const BUBBLE_AUTO_HIDE_MS = 8_000;

/** HTMLタグを除去してプレーンテキストを返す */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

export function CharacterWidget() {
  const { characterSettings, setCharacterSettings, theme } = useUIStore();
  const sessionSummary = useUIStore((s) => s.sessionSummary);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const currentEpisode = useEditorStore((s) => s.currentEpisode);

  const [showBubble, setShowBubble] = useState(false);
  const [message, setMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // 各種アニメーションステート
  const [isThinking, setIsThinking] = useState(false);
  const [isSleepy, setIsSleepy] = useState(false);
  const [isSurprised, setIsSurprised] = useState(false);
  const [isHappy, setIsHappy] = useState(false);

  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const [shouldRender, setShouldRender] = useState(characterSettings.enabled);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // ON/OFF時のフェードイン・フェードアウト制御
  useEffect(() => {
    if (characterSettings.enabled) {
      setShouldRender(true);
      setIsFadingOut(false);
    } else if (shouldRender) {
      setIsFadingOut(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsFadingOut(false);
      }, 300); // fadeOutアニメーション(.ghost-widget-out)完了後にアンマウント
      return () => clearTimeout(timer);
    }
  }, [characterSettings.enabled, shouldRender]);

  // タイピング再開 → 吹き出しを消す & スリープタイマーをリセット
  useEffect(() => {
    if (!characterSettings.enabled) return;

    const resetSleepTimer = () => {
      setIsSleepy(false);
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      // 15秒間放置されたらスリープ（深呼吸）状態にする
      sleepTimerRef.current = setTimeout(() => {
        setIsSleepy(true);
      }, 15000);
    };

    resetSleepTimer();

    const unsub = onActivity(() => {
      setShowBubble(false);
      setIsThinking(false);
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
      resetSleepTimer();
    });

    return () => {
      unsub();
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    };
  }, [characterSettings.enabled]);

  // セッション終了時にお祝いリアクション（喜びアニメーション + ねぎらいの吹き出し）
  const celebratedRef = useRef<typeof sessionSummary>(null);
  useEffect(() => {
    if (!sessionSummary || !characterSettings.enabled) return;
    // 同じサマリーへの再発火（キャラON/OFF切替など）を防ぐ
    if (celebratedRef.current === sessionSummary) return;
    celebratedRef.current = sessionSummary;
    setIsHappy(true);
    const happyTimer = setTimeout(() => setIsHappy(false), 1400);

    const pool = sessionSummary.chars > 0 ? CELEBRATE_WITH_CHARS : CELEBRATE_NO_CHARS;
    const template = pool[Math.floor(Math.random() * pool.length)];
    setMessage(template.replace('{chars}', `+${sessionSummary.chars.toLocaleString()}`));
    setShowBubble(true);
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    bubbleTimerRef.current = setTimeout(() => setShowBubble(false), BUBBLE_AUTO_HIDE_MS);

    return () => clearTimeout(happyTimer);
  }, [sessionSummary, characterSettings.enabled]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    };
  }, []);

  // 設定メニュー外クリックで閉じる
  useEffect(() => {
    if (!showSettings) return;
    const handleOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showSettings]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowBubble(false);
    setShowSettings((prev) => !prev);
  };

  if (!shouldRender) return null;

  const handleClick = async () => {
    // びっくりアニメーション（クリック直後）
    setIsSurprised(true);
    setTimeout(() => setIsSurprised(false), 400);

    // スリープ状態を解除＆タイマーリセット
    setIsSleepy(false);
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    sleepTimerRef.current = setTimeout(() => setIsSleepy(true), 15000);

    // すでに表示中なら閉じる
    if (showBubble) {
      setShowBubble(false);
      setIsThinking(false);
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
      return;
    }

    // 「考え中」表示
    setMessage('…');
    setShowBubble(true);
    setIsThinking(true);

    try {
      const plain = stripHtml(currentEpisode?.body ?? '');

      if (characterSettings.readerMode) {
        // 読者モード: 600文字コンテキスト + ai_get_reader_perspective
        const context = plain.length > 600 ? plain.slice(-600) : plain;
        const aiMsg = await invoke<string>('ai_get_reader_perspective', {
          projectId: currentProjectId ?? '',
          context,
          persona: characterSettings.readerPersona ?? 'casual',
        });
        setMessage(aiMsg);
      } else {
        // 通常モード: 300文字コンテキスト + ai_get_whisper
        const context = plain.length > 300 ? plain.slice(-300) : plain;

        // たっぷり書いた後は喜ぶアクション
        if (context.length >= 200) {
          setTimeout(() => {
            setIsHappy(true);
            setTimeout(() => setIsHappy(false), 700);
          }, 500);
        }

        const aiMsg = await invoke<string>('ai_get_whisper', {
          projectId: currentProjectId ?? '',
          context,
        });
        setMessage(aiMsg);
      }
    } catch {
      // AIエラー時のフォールバック
      const fallbacks = characterSettings.readerMode ? READER_FALLBACKS : WHISPERS;
      const msg = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      setMessage(msg);
    } finally {
      setIsThinking(false);
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
      bubbleTimerRef.current = setTimeout(() => setShowBubble(false), BUBBLE_AUTO_HIDE_MS);
    }
  };

  // 優先順位に基づいてアニメーションクラスを決定
  let animationClass = 'ghost-float';
  if (isSurprised) animationClass = 'ghost-surprised';
  else if (isHappy) animationClass = 'ghost-happy';
  else if (isThinking) animationClass = 'ghost-thinking';
  else if (isSleepy) animationClass = 'ghost-sleepy';

  return (
    <div
      className={isFadingOut ? 'ghost-widget-out' : 'ghost-widget-in'}
      style={{
        position: 'fixed',
        bottom: '80px',
        right: '24px',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
    >
      {showSettings && (
        <div ref={settingsRef}>
          <GhostSettingsMenu
            characterSettings={characterSettings}
            setCharacterSettings={setCharacterSettings}
            onClose={() => setShowSettings(false)}
          />
        </div>
      )}
      {showBubble && !showSettings && <SpeechBubble message={message} thinking={isThinking} />}
      <div
        className={animationClass}
        onClick={() => { void handleClick(); }}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ cursor: isThinking ? 'wait' : 'pointer', position: 'relative' }}
        title={characterSettings.readerMode ? 'クリックで読者の声を聞く / 右クリックで設定' : 'クリックでつぶやく / 右クリックで設定'}
      >
        {isHappy && (
          <>
            <div className="particle particle-1">✨</div>
            <div className="particle particle-2">💖</div>
            <div className="particle particle-3">✨</div>
          </>
        )}
        <GhostSVG theme={theme} isHovered={isHovered} />
      </div>
    </div>
  );
}

// =========================================
// サブコンポーネント
// =========================================

function GhostSettingsMenu({
  characterSettings,
  setCharacterSettings,
  onClose,
}: {
  characterSettings: CharacterSettings;
  setCharacterSettings: (s: CharacterSettings) => void;
  onClose: () => void;
}) {
  const PERSONAS: { key: ReaderPersona; label: string; desc: string }[] = [
    { key: 'casual', label: '一般', desc: '感情・共感重視' },
    { key: 'genre', label: 'ジャンル', desc: '期待・伏線重視' },
    { key: 'critical', label: '批評的', desc: '整合性・理解重視' },
  ];

  return (
    <div
      style={{
        background: 'rgba(18, 12, 36, 0.97)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(160, 148, 220, 0.3)',
        borderRadius: '12px',
        padding: '12px 14px',
        marginBottom: '8px',
        width: '196px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        color: 'rgba(228, 222, 255, 0.95)',
        fontSize: '12px',
      }}
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontWeight: 600, fontSize: '11px', letterSpacing: '0.05em', color: 'rgba(180,168,255,0.9)' }}>
          ゴーストちゃん設定
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(180,168,255,0.5)', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}
        >
          ×
        </button>
      </div>

      {/* 読者モードトグル */}
      <div className="flex items-center justify-between mb-2">
        <span style={{ color: 'rgba(228,222,255,0.8)' }}>読者モード</span>
        <button
          onClick={() => setCharacterSettings({ ...characterSettings, readerMode: !characterSettings.readerMode })}
          style={{
            width: '32px',
            height: '18px',
            borderRadius: '9px',
            background: characterSettings.readerMode ? 'rgba(139,124,246,0.9)' : 'rgba(255,255,255,0.12)',
            border: `1px solid ${characterSettings.readerMode ? 'rgba(139,124,246,0.6)' : 'rgba(255,255,255,0.2)'}`,
            position: 'relative',
            cursor: 'pointer',
            transition: 'background 200ms',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: '2px',
              left: characterSettings.readerMode ? '14px' : '2px',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: characterSettings.readerMode ? 'rgba(18,12,36,0.9)' : 'rgba(180,168,255,0.6)',
              transition: 'left 200ms',
            }}
          />
        </button>
      </div>

      {/* ペルソナ選択（読者モードON時のみ） */}
      {characterSettings.readerMode && (
        <div>
          <div style={{ fontSize: '10px', color: 'rgba(180,168,255,0.55)', marginBottom: '6px' }}>読者タイプ</div>
          <div className="flex flex-col gap-1">
            {PERSONAS.map((p) => {
              const active = (characterSettings.readerPersona ?? 'casual') === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => setCharacterSettings({ ...characterSettings, readerPersona: p.key })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 8px',
                    borderRadius: '7px',
                    background: active ? 'rgba(139,124,246,0.18)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${active ? 'rgba(139,124,246,0.45)' : 'rgba(255,255,255,0.08)'}`,
                    cursor: 'pointer',
                    color: active ? 'rgba(200,192,255,0.95)' : 'rgba(180,168,255,0.6)',
                    transition: 'all 150ms',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontWeight: active ? 600 : 400 }}>{p.label}</span>
                  <span style={{ fontSize: '10px', opacity: 0.65 }}>{p.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SpeechBubble({ message, thinking }: { message: string; thinking?: boolean }) {
  return (
    <div
      className="ghost-bubble-anim"
      style={{
        background: 'rgba(24, 16, 44, 0.92)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(160, 148, 220, 0.35)',
        borderRadius: '12px',
        padding: '10px 14px',
        maxWidth: '200px',
        marginBottom: '8px',
        color: 'rgba(228, 222, 255, 0.96)',
        fontSize: '12px',
        lineHeight: '1.75',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        position: 'relative',
        userSelect: 'none',
        minWidth: '48px',
        textAlign: thinking ? 'center' : 'left',
      }}
    >
      {thinking ? (
        /* 点滅ドット（考え中） */
        <span style={{ letterSpacing: '4px', opacity: 0.8 }}>…</span>
      ) : (
        message
      )}
      {/* 吹き出しの三角ポインタ */}
      <div
        style={{
          position: 'absolute',
          bottom: '-7px',
          right: '30px',
          width: 0,
          height: 0,
          borderLeft: '7px solid transparent',
          borderRight: '7px solid transparent',
          borderTop: '7px solid rgba(24, 16, 44, 0.92)',
        }}
      />
    </div>
  );
}

function GhostSVG({ theme, isHovered }: { theme: 'dark' | 'light'; isHovered?: boolean }) {
  const bodyFill = theme === 'dark' ? '#e2e8f0' : '#ffffff';
  // ダークテーマでも、キャラクターの輪郭は引き締めたダークグレーに
  const strokeColor = theme === 'dark' ? '#1e293b' : '#0f172a';
  const glowColor =
    theme === 'dark'
      ? 'rgba(168, 188, 255, 0.4)'
      : 'rgba(120, 152, 240, 0.3)';

  return (
    <svg
      viewBox="0 0 100 115"
      width="80"
      height="92"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        filter: `drop-shadow(0 0 12px ${glowColor}) drop-shadow(0 6px 12px rgba(0,0,0,0.15))`,
        display: 'block',
      }}
    >
      {/* 胴体：アウトラインを太くし、ポップでキュートなフォルムに */}
      <path
        fill={bodyFill}
        stroke={strokeColor}
        strokeWidth="4"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <animate
          attributeName="d"
          dur="3.6s"
          repeatCount="indefinite"
          values="
            M 50 15 C 25 15, 15 30, 15 50 C 15 65, 10 80, 20 88.5 C 25 93.5, 33 93, 35 87 C 40 96, 50 95, 52 85 C 58 93, 67 90, 68 82 C 75 88, 85 88, 83 72 C 81 50, 75 20, 50 15 Z;
            M 50 15 C 25 15, 15 30, 15 50 C 15 65, 10 80, 20 90 C 25 95, 33 90.5, 35 84.5 C 40 93.5, 50 96, 52 86 C 58 94, 67 90, 68 82 C 75 88, 85 88, 83 72 C 81 50, 75 20, 50 15 Z;
            M 50 15 C 25 15, 15 30, 15 50 C 15 65, 10 80, 20 90 C 25 95, 33 92, 35 86 C 40 95, 50 93.5, 52 83.5 C 58 91.5, 67 91, 68 83 C 75 89, 85 88, 83 72 C 81 50, 75 20, 50 15 Z;
            M 50 15 C 25 15, 15 30, 15 50 C 15 65, 10 80, 20 90 C 25 95, 33 92, 35 86 C 40 95, 50 95, 52 85 C 58 93, 67 88.5, 68 80.5 C 75 86.5, 85 89, 83 73 C 81 50, 75 20, 50 15 Z;
            M 50 15 C 25 15, 15 30, 15 50 C 15 65, 10 80, 20 91 C 25 96, 33 92, 35 86 C 40 95, 50 95, 52 85 C 58 93, 67 90, 68 82 C 75 88, 85 86.5, 83 70.5 C 81 50, 75 20, 50 15 Z;
            M 50 15 C 25 15, 15 30, 15 50 C 15 65, 10 80, 20 88.5 C 25 93.5, 33 93, 35 87 C 40 96, 50 95, 52 85 C 58 93, 67 90, 68 82 C 75 88, 85 88, 83 72 C 81 50, 75 20, 50 15 Z
          "
        />
      </path>
      
      {/* 布のドレープ（シワ）の線 */}
      <path
        fill="none"
        stroke={strokeColor}
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ display: 'none' }} // 一時的に非表示
      >
        <animate
          attributeName="d"
          dur="3.6s"
          repeatCount="indefinite"
          values="
            M 35 85 Q 34 81, 35 77;
            M 35 82.5 Q 34 78.5, 35 74.5;
            M 35 84 Q 34 80, 35 76;
            M 35 84 Q 34 80, 35 76;
            M 35 84 Q 34 80, 35 76;
            M 35 85 Q 34 81, 35 77
          "
        />
      </path>
      <path
        fill="none"
        stroke={strokeColor}
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ display: 'none' }} // 一時的に非表示
      >
        <animate
          attributeName="d"
          dur="3.6s"
          repeatCount="indefinite"
          values="
            M 66 80 Q 64 75, 65 71;
            M 66 80 Q 64 75, 65 71;
            M 66 81 Q 64 76, 65 72;
            M 66 78.5 Q 64 73.5, 65 69.5;
            M 66 80 Q 64 75, 65 71;
            M 66 80 Q 64 75, 65 71
          "
        />
      </path>

      {/* ほっぺ（チーク） - ホバー時に照れる */}
      <ellipse cx="26" cy={isHovered ? "45" : "46"} rx={isHovered ? "5" : "4"} ry={isHovered ? "3.5" : "2.5"} fill="#ff8a8a" opacity={isHovered ? "0.95" : "0.75"} style={{ transition: 'all 0.2s' }} />
      <ellipse cx="60" cy={isHovered ? "45" : "46"} rx={isHovered ? "5" : "4"} ry={isHovered ? "3.5" : "2.5"} fill="#ff8a8a" opacity={isHovered ? "0.95" : "0.75"} style={{ transition: 'all 0.2s' }} />

      {/* 目 - ホバー時ににっこり */}
      {isHovered ? (
        <>
          <path d="M 30 42 Q 34 36, 38 42" fill="none" stroke={strokeColor} strokeWidth="3" strokeLinecap="round" />
          <path d="M 48 42 Q 52 36, 56 42" fill="none" stroke={strokeColor} strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse
            cx="34"
            cy="40"
            rx="4"
            ry="7"
            fill={strokeColor}
            className="ghost-eye"
          />
          <ellipse
            cx="52"
            cy="40"
            rx="4.5"
            ry="7.5"
            fill={strokeColor}
            className="ghost-eye ghost-eye-right"
          />
        </>
      )}
    </svg>
  );
}

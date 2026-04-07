import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ベース（屋根裏の木材・闇）
        "bg-deep": "#1a1714",
        "bg-base": "#242019",
        "bg-surface": "#2e2923",
        "bg-elevated": "#3a332c",
        // テキスト
        "text-base": "#e8e0d4",
        "text-mid": "#b8ad9e",
        "text-muted": "#7a7068",
        // アクセント（ランプの灯り・琥珀色）
        accent: "#c4956a",
        "accent-hover": "#d4a87a",
        // ボーダー
        "border-base": "#3e3730",
        "border-light": "#4a423a",
        // セマンティック
        success: "#7aad8a",
        warning: "#c9a55a",
        danger: "#b07070",
        // 特殊
        lamp: "#f5e6c8",
      },
      fontFamily: {
        heading: ['"Shippori Mincho"', "serif"],
        ui: ['"Noto Sans JP"', "sans-serif"],
        editor: ['"游明朝"', '"Yu Mincho"', '"Noto Serif JP"', "serif"],
      },
      boxShadow: {
        // 影はすべてウォームブラック（設計原則）
        panel: "0 2px 8px rgba(20,16,12,0.3)",
        modal: "0 8px 32px rgba(20,16,12,0.5)",
        focus: "0 0 8px #f5e6c8",
      },
      transitionTimingFunction: {
        // アニメーションは緩やかなease-out（設計原則）
        DEFAULT: "ease-out",
      },
      transitionDuration: {
        DEFAULT: "200ms",
      },
    },
  },
  plugins: [],
} satisfies Config;

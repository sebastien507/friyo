/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Light mode (default)
        canvas: "#F4F7F5",
        surface: "#FFFFFF",
        surface2: "#EEF3F0",
        mint: "#10B488",
        coral: "#FF8A6B",
        "fr-blue": "#7CA8FF",
        txt: "#16201C",
        muted: "#73827B",
        // Dark mode variants (used with dark: prefix)
        "canvas-d": "#14181E",
        "surface-d": "#1E242C",
        "surface2-d": "#28313B",
        "mint-d": "#3FE0B6",
        "txt-d": "#EEF1F4",
        "muted-d": "#8A95A2",
        // Legacy semantic aliases (light default + dark variant)
        primary: "#10B488",
        "primary-d": "#3FE0B6",
        accent: "#10B488",
        "accent-d": "#3FE0B6",
        cream: "#F4F7F5",
        "cream-d": "#14181E",
        ink: "#16201C",
        "ink-d": "#EEF1F4",
        softgray: "#EEF3F0",
        "softgray-d": "#28313B",
        warm: "#FF8A6B",
        success: "#10B488",
        "success-d": "#3FE0B6",
        error: "#FF8A6B",
      },
      fontFamily: {
        brand: ["Fredoka_600SemiBold"],
      },
    },
  },
  plugins: [],
};

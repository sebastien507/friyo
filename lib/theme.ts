export const light = {
  canvas: "#F4F7F5",
  surface: "#FFFFFF",
  surface2: "#EEF3F0",
  mint: "#10B488",
  txt: "#16201C",
  muted: "#73827B",
  border: "rgba(0,0,0,0.08)",
  mintBg: "rgba(16,180,136,0.10)",
  coralBg: "rgba(255,138,107,0.10)",
} as const;

export const dark = {
  canvas: "#14181E",
  surface: "#1E242C",
  surface2: "#28313B",
  mint: "#3FE0B6",
  txt: "#EEF1F4",
  muted: "#8A95A2",
  border: "rgba(255,255,255,0.09)",
  mintBg: "rgba(63,224,182,0.12)",
  coralBg: "rgba(255,138,107,0.12)",
} as const;

// Keep legacy export for backward compat
export const colors = dark;

import type { CSSProperties } from 'react';

export type CaptionBgStyle =
  | 'dark'
  | 'light'
  | 'pink'
  | 'none'
  | 'purple'
  | 'blue'
  | 'sunset'
  | 'mint'
  | 'gold'
  | 'grad-ocean'
  | 'grad-aurora'
  | 'grad-cotton'
  | 'grad-peach'
  | 'grad-lavender'
  | 'grad-fire'
  | 'grad-night'
  | 'grad-bubble'
  | 'grad-tropical'
  | 'grad-cyber'
  | 'grad-rose'
  | 'pastel-pink'
  | 'pastel-lavender'
  | 'pastel-mint'
  | 'pastel-peach'
  | 'pastel-sky'
  | 'pastel-lemon'
  | 'pastel-lilac'
  | 'pastel-coral'
  | 'custom';

export type CaptionTextEffect =
  | 'none'
  | 'glow'
  | 'shadow'
  | 'outline'
  | 'neon'
  | 'wave'
  | 'gradient'
  | 'sparkle'
  | 'shake'
  | 'retro'
  | 'marquee'
  | 'typewriter'
  | 'bounce'
  | 'blink'
  | 'pulse'
  | 'float'
  | 'zoom';

export const CAPTION_TEXT_EFFECTS: { key: CaptionTextEffect; label: string; hint: string }[] = [
  { key: 'none', label: '✨', hint: 'Mặc định' },
  { key: 'glow', label: '💫', hint: 'Phát sáng' },
  { key: 'shadow', label: '🌑', hint: 'Đổ bóng' },
  { key: 'outline', label: '⭕', hint: 'Viền' },
  { key: 'neon', label: '⚡', hint: 'Neon' },
  { key: 'wave', label: '🌊', hint: 'Sóng' },
  { key: 'gradient', label: '🌈', hint: 'Gradient' },
  { key: 'sparkle', label: '✴️', hint: 'Lấp lánh' },
  { key: 'shake', label: '💥', hint: 'Rung' },
  { key: 'retro', label: '👾', hint: 'Retro' },
  { key: 'marquee', label: '📜', hint: 'Chữ chạy' },
  { key: 'typewriter', label: '⌨️', hint: 'Gõ chữ' },
  { key: 'bounce', label: '🏀', hint: 'Nảy' },
  { key: 'blink', label: '💡', hint: 'Nhấp nháy' },
  { key: 'pulse', label: '💓', hint: 'Pulse' },
  { key: 'float', label: '🎈', hint: 'Bay' },
  { key: 'zoom', label: '🔍', hint: 'Zoom' },
];

export type CaptionBgPreset = {
  key: CaptionBgStyle;
  label: string;
  preview: string;
  group: 'solid' | 'gradient' | 'pastel' | 'special';
};

export const CAPTION_BG_PRESETS: CaptionBgPreset[] = [
  { key: 'dark', label: '⬛', preview: 'rgba(0,0,0,0.62)', group: 'solid' },
  { key: 'light', label: '⬜', preview: 'rgba(255,255,255,0.72)', group: 'solid' },
  { key: 'pink', label: '🩷', preview: 'rgba(236,72,153,0.78)', group: 'solid' },
  { key: 'purple', label: '💜', preview: 'rgba(139,92,246,0.78)', group: 'solid' },
  { key: 'blue', label: '💙', preview: 'rgba(59,130,246,0.78)', group: 'solid' },
  { key: 'mint', label: '🌿', preview: 'rgba(52,211,153,0.78)', group: 'solid' },
  { key: 'gold', label: '✨', preview: 'rgba(245,158,11,0.82)', group: 'solid' },
  {
    key: 'sunset',
    label: '🌅',
    preview: 'linear-gradient(135deg, rgba(251,113,133,0.9), rgba(251,191,36,0.88))',
    group: 'gradient',
  },
  {
    key: 'grad-ocean',
    label: '🌊',
    preview: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    group: 'gradient',
  },
  {
    key: 'grad-aurora',
    label: '🌌',
    preview: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 50%, #9d50bb 100%)',
    group: 'gradient',
  },
  {
    key: 'grad-cotton',
    label: '🍬',
    preview: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)',
    group: 'gradient',
  },
  {
    key: 'grad-peach',
    label: '🍑',
    preview: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    group: 'gradient',
  },
  {
    key: 'grad-lavender',
    label: '💐',
    preview: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
    group: 'gradient',
  },
  {
    key: 'grad-fire',
    label: '🔥',
    preview: 'linear-gradient(135deg, #f12711 0%, #f5af19 100%)',
    group: 'gradient',
  },
  {
    key: 'grad-night',
    label: '🌙',
    preview: 'linear-gradient(135deg, #232526 0%, #414345 100%)',
    group: 'gradient',
  },
  {
    key: 'grad-bubble',
    label: '💗',
    preview: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    group: 'gradient',
  },
  {
    key: 'grad-tropical',
    label: '🏝️',
    preview: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    group: 'gradient',
  },
  {
    key: 'grad-cyber',
    label: '🤖',
    preview: 'linear-gradient(135deg, #08aeea 0%, #2af598 100%)',
    group: 'gradient',
  },
  {
    key: 'grad-rose',
    label: '🌹',
    preview: 'linear-gradient(135deg, #ee9ca7 0%, #ffdde1 100%)',
    group: 'gradient',
  },
  { key: 'pastel-pink', label: '🌸', preview: 'rgba(255, 182, 193, 0.88)', group: 'pastel' },
  { key: 'pastel-lavender', label: '🔮', preview: 'rgba(230, 230, 250, 0.9)', group: 'pastel' },
  { key: 'pastel-mint', label: '🍃', preview: 'rgba(189, 252, 201, 0.88)', group: 'pastel' },
  { key: 'pastel-peach', label: '🧁', preview: 'rgba(255, 218, 185, 0.9)', group: 'pastel' },
  { key: 'pastel-sky', label: '☁️', preview: 'rgba(173, 216, 230, 0.88)', group: 'pastel' },
  { key: 'pastel-lemon', label: '🍋', preview: 'rgba(255, 250, 205, 0.9)', group: 'pastel' },
  { key: 'pastel-lilac', label: '💜', preview: 'rgba(221, 160, 221, 0.85)', group: 'pastel' },
  { key: 'pastel-coral', label: '🪸', preview: 'rgba(255, 160, 122, 0.88)', group: 'pastel' },
  { key: 'none', label: '🚫', preview: 'transparent', group: 'special' },
  { key: 'custom', label: '🎨', preview: 'transparent', group: 'special' },
];

export type CaptionTextColorPreset = {
  value: string;
  swatch: string;
  group: 'classic' | 'pastel' | 'gradient';
};

/** Solid + gradient text colors (stored as hex or full CSS gradient in DB). */
export const CAPTION_TEXT_COLOR_PRESETS: CaptionTextColorPreset[] = [
  { value: '#ffffff', swatch: '#ffffff', group: 'classic' },
  { value: '#000000', swatch: '#000000', group: 'classic' },
  { value: '#ff4d6d', swatch: '#ff4d6d', group: 'classic' },
  { value: '#fbbf24', swatch: '#fbbf24', group: 'classic' },
  { value: '#34d399', swatch: '#34d399', group: 'classic' },
  { value: '#60a5fa', swatch: '#60a5fa', group: 'classic' },
  { value: '#a78bfa', swatch: '#a78bfa', group: 'classic' },
  { value: '#f472b6', swatch: '#f472b6', group: 'classic' },
  { value: '#fef08a', swatch: '#fef08a', group: 'classic' },
  { value: '#e2e8f0', swatch: '#e2e8f0', group: 'classic' },
  { value: '#fda4af', swatch: '#fda4af', group: 'pastel' },
  { value: '#c4b5fd', swatch: '#c4b5fd', group: 'pastel' },
  { value: '#99f6e4', swatch: '#99f6e4', group: 'pastel' },
  { value: '#fde68a', swatch: '#fde68a', group: 'pastel' },
  { value: '#bae6fd', swatch: '#bae6fd', group: 'pastel' },
  { value: '#fbcfe8', swatch: '#fbcfe8', group: 'pastel' },
  { value: '#fcd34d', swatch: '#fcd34d', group: 'pastel' },
  { value: '#bbf7d0', swatch: '#bbf7d0', group: 'pastel' },
  {
    value: 'linear-gradient(90deg, #ff6b9d, #ffc371)',
    swatch: 'linear-gradient(90deg, #ff6b9d, #ffc371)',
    group: 'gradient',
  },
  {
    value: 'linear-gradient(90deg, #a18cd1, #fbc2eb)',
    swatch: 'linear-gradient(90deg, #a18cd1, #fbc2eb)',
    group: 'gradient',
  },
  {
    value: 'linear-gradient(90deg, #00c6ff, #0072ff)',
    swatch: 'linear-gradient(90deg, #00c6ff, #0072ff)',
    group: 'gradient',
  },
  {
    value: 'linear-gradient(90deg, #f12711, #f5af19)',
    swatch: 'linear-gradient(90deg, #f12711, #f5af19)',
    group: 'gradient',
  },
  {
    value: 'linear-gradient(90deg, #11998e, #38ef7d)',
    swatch: 'linear-gradient(90deg, #11998e, #38ef7d)',
    group: 'gradient',
  },
  {
    value: 'linear-gradient(90deg, #ee9ca7, #ffdde1)',
    swatch: 'linear-gradient(90deg, #ee9ca7, #ffdde1)',
    group: 'gradient',
  },
  {
    value: 'linear-gradient(90deg, #f093fb, #f5576c)',
    swatch: 'linear-gradient(90deg, #f093fb, #f5576c)',
    group: 'gradient',
  },
  {
    value: 'linear-gradient(90deg, #08aeea, #2af598)',
    swatch: 'linear-gradient(90deg, #08aeea, #2af598)',
    group: 'gradient',
  },
];

/** @deprecated use CAPTION_TEXT_COLOR_PRESETS */
export const CAPTION_TEXT_COLORS = CAPTION_TEXT_COLOR_PRESETS.filter((p) => p.group === 'classic').map(
  (p) => p.value
);

export function isGradientCss(value: string): boolean {
  return /^(linear|radial|conic)-gradient/i.test(value.trim());
}

export function resolveCaptionTextStyle(color: string | null | undefined): CSSProperties {
  if (!color) return { color: '#ffffff' };
  if (isGradientCss(color)) {
    return {
      background: color,
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      color: 'transparent',
    };
  }
  return { color };
}

export function resolveCaptionBackground(
  style: string | null | undefined,
  customColor?: string | null
): CSSProperties {
  if (style === 'custom' && customColor) {
    if (isGradientCss(customColor)) {
      return { background: customColor };
    }
    return { background: customColor };
  }
  const preset = CAPTION_BG_PRESETS.find((p) => p.key === style);
  if (preset) {
    return { background: preset.preview };
  }
  return { background: 'rgba(0,0,0,0.60)' };
}

export function getCaptionPreviewBg(
  style: CaptionBgStyle,
  customColor?: string
): CSSProperties['background'] {
  if (style === 'custom' && customColor) return customColor;
  const preset = CAPTION_BG_PRESETS.find((p) => p.key === style);
  return preset?.preview ?? 'rgba(0,0,0,0.55)';
}

export function getCaptionTextEffectClass(effect: string | null | undefined): string {
  if (!effect || effect === 'none') return '';
  return `caption-fx-${effect}`;
}

export function needsMarqueeWrapper(effect: string | null | undefined): boolean {
  return effect === 'marquee';
}

/** @deprecated use resolveCaptionBackground */
export function getCaptionBgStyle(bg: CaptionBgStyle | string | null | undefined): CSSProperties {
  return resolveCaptionBackground(bg);
}

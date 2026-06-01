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
  | 'retro';

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
];

export const CAPTION_BG_PRESETS: {
  key: CaptionBgStyle;
  label: string;
  preview: string;
  swatch?: string;
}[] = [
  { key: 'dark', label: '⬛', preview: 'rgba(0,0,0,0.60)', swatch: '#1a1a1a' },
  { key: 'light', label: '⬜', preview: 'rgba(255,255,255,0.68)', swatch: '#f8f8f8' },
  { key: 'pink', label: '🩷', preview: 'rgba(236,72,153,0.78)', swatch: '#ec4899' },
  { key: 'purple', label: '💜', preview: 'rgba(139,92,246,0.75)', swatch: '#8b5cf6' },
  { key: 'blue', label: '💙', preview: 'rgba(59,130,246,0.75)', swatch: '#3b82f6' },
  { key: 'sunset', label: '🌅', preview: 'linear-gradient(135deg, rgba(251,113,133,0.85), rgba(251,191,36,0.85))', swatch: '#fb7185' },
  { key: 'mint', label: '🌿', preview: 'rgba(52,211,153,0.78)', swatch: '#34d399' },
  { key: 'gold', label: '✨', preview: 'rgba(245,158,11,0.82)', swatch: '#f59e0b' },
  { key: 'none', label: '🚫', preview: 'transparent', swatch: 'transparent' },
  { key: 'custom', label: '🎨', preview: 'transparent' },
];

export const CAPTION_TEXT_COLORS = [
  '#ffffff',
  '#000000',
  '#ff4d6d',
  '#fbbf24',
  '#34d399',
  '#60a5fa',
  '#a78bfa',
  '#f472b6',
  '#fef08a',
  '#e2e8f0',
];

export function resolveCaptionBackground(
  style: string | null | undefined,
  customColor?: string | null
): CSSProperties {
  if (style === 'custom' && customColor) {
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

/** @deprecated use resolveCaptionBackground */
export function getCaptionBgStyle(bg: CaptionBgStyle | string | null | undefined): CSSProperties {
  return resolveCaptionBackground(bg);
}

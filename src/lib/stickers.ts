export const STICKER_SCALE_MIN = 0.08;
export const STICKER_SCALE_MAX = 0.55;

export function clampStickerScale(scale: number): number {
  return Math.min(STICKER_SCALE_MAX, Math.max(STICKER_SCALE_MIN, scale));
}

export type StickerKind = 'emoji' | 'image';

export interface StickerPlacement {
  id: string;
  kind: StickerKind;
  /** Emoji character or image URL (data URL / https) */
  src: string;
  /** Center X 0–1 */
  x: number;
  /** Center Y 0–1 */
  y: number;
  /** Size relative to preview width */
  scale: number;
  rotation: number;
}

export interface CustomStickerAsset {
  id: string;
  name: string;
  src: string;
  createdAt: number;
}

const CUSTOM_KEY = 'supa_custom_stickers_v1';
const MAX_CUSTOM = 24;

export const BUILTIN_STICKERS: { id: string; label: string; src: string; kind: StickerKind }[] = [
  { id: 'e-laugh', label: '😂', src: '😂', kind: 'emoji' },
  { id: 'e-fire', label: '🔥', src: '🔥', kind: 'emoji' },
  { id: 'e-skull', label: '💀', src: '💀', kind: 'emoji' },
  { id: 'e-spark', label: '✨', src: '✨', kind: 'emoji' },
  { id: 'e-salute', label: '🫡', src: '🫡', kind: 'emoji' },
  { id: 'e-eyes', label: '👀', src: '👀', kind: 'emoji' },
  { id: 'e-100', label: '💯', src: '💯', kind: 'emoji' },
  { id: 'e-clown', label: '🤡', src: '🤡', kind: 'emoji' },
  { id: 'e-plead', label: '🥺', src: '🥺', kind: 'emoji' },
  { id: 'e-heart', label: '💖', src: '💖', kind: 'emoji' },
  { id: 'e-pray', label: '🙏', src: '🙏', kind: 'emoji' },
  { id: 'e-cry', label: '😭', src: '😭', kind: 'emoji' },
  { id: 'e-moyai', label: '🗿', src: '🗿', kind: 'emoji' },
  { id: 'e-ok', label: '👍', src: '👍', kind: 'emoji' },
  { id: 'e-party', label: '🎉', src: '🎉', kind: 'emoji' },
  { id: 'e-love', label: '😍', src: '😍', kind: 'emoji' },
  { id: 'e-shock', label: '😱', src: '😱', kind: 'emoji' },
  { id: 'e-cool', label: '😎', src: '😎', kind: 'emoji' },
  { id: 'e-angry', label: '😤', src: '😤', kind: 'emoji' },
  { id: 'e-mind', label: '🤯', src: '🤯', kind: 'emoji' },
];

/** Meme-style labels (rendered as bold text stickers) */
export const MEME_TEXT_STICKERS: { id: string; label: string; src: string }[] = [
  { id: 'm-vl', label: 'VL', src: 'VL' },
  { id: 'm-ok', label: 'OK', src: 'OK' },
  { id: 'm-wtf', label: 'WTF', src: 'WTF' },
  { id: 'm-sos', label: 'SOS', src: 'SOS' },
  { id: 'm-rip', label: 'RIP', src: 'RIP' },
  { id: 'm-goat', label: 'GOAT', src: 'GOAT' },
  { id: 'm-nhau', label: 'NHẬU', src: 'NHẬU' },
  { id: 'm-yeu', label: 'YÊU', src: 'YÊU' },
];

export function loadCustomStickers(): CustomStickerAsset[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomStickerAsset[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomSticker(asset: CustomStickerAsset): CustomStickerAsset[] {
  const list = loadCustomStickers().filter((s) => s.id !== asset.id);
  list.unshift(asset);
  const trimmed = list.slice(0, MAX_CUSTOM);
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(trimmed));
  return trimmed;
}

export function removeCustomSticker(id: string): CustomStickerAsset[] {
  const list = loadCustomStickers().filter((s) => s.id !== id);
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
  return list;
}

export function createStickerPlacement(
  src: string,
  kind: StickerKind,
  index = 0
): StickerPlacement {
  const jitter = (index % 5) * 0.04;
  return {
    id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    src,
    x: 0.5 + (index % 2 === 0 ? jitter : -jitter),
    y: 0.45 + (index % 3) * 0.05,
    scale: kind === 'emoji' ? 0.2 : 0.28,
    rotation: 0,
  };
}

export function parseStickersJson(raw: string | null | undefined): StickerPlacement[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function stickersToJson(stickers: StickerPlacement[]): string | null {
  if (!stickers.length) return null;
  return JSON.stringify(stickers);
}

export function isAnimatedStickerSrc(src: string): boolean {
  return /\.gif(\?|$)/i.test(src) || src.startsWith('data:image/gif');
}

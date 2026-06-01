import type { StickerPlacement } from './stickers';
import { MEME_TEXT_STICKERS } from './stickers';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load sticker image'));
    img.src = src;
  });
}

function isMemeText(src: string): boolean {
  return MEME_TEXT_STICKERS.some((m) => m.src === src);
}

async function drawSticker(
  ctx: CanvasRenderingContext2D,
  sticker: StickerPlacement,
  size: number
) {
  const cx = sticker.x * size;
  const cy = sticker.y * size;
  const stickerSize = sticker.scale * size;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((sticker.rotation * Math.PI) / 180);

  if (sticker.kind === 'emoji' || isMemeText(sticker.src)) {
    const isMeme = isMemeText(sticker.src);
    ctx.font = `bold ${stickerSize * (isMeme ? 0.55 : 0.85)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (isMeme) {
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = stickerSize * 0.04;
      ctx.strokeText(sticker.src, 0, 0);
    }
    ctx.fillStyle = isMeme ? '#ff4d6d' : '#ffffff';
    ctx.fillText(sticker.src, 0, 0);
  } else {
    try {
      const img = await loadImage(sticker.src);
      const aspect = img.width / img.height || 1;
      const w = stickerSize;
      const h = stickerSize / aspect;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } catch {
      /* skip broken sticker */
    }
  }

  ctx.restore();
}

/** Bake stickers into a square JPEG snap (photos only). */
export async function compositeSnapImage(
  baseBlob: Blob,
  stickers: StickerPlacement[],
  quality = 0.92
): Promise<Blob> {
  if (!stickers.length) return baseBlob;

  const bitmap = await createImageBitmap(baseBlob);
  const size = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return baseBlob;
  }

  const sx = (bitmap.width - size) / 2;
  const sy = (bitmap.height - size) / 2;
  ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, size, size);
  bitmap.close();

  for (const sticker of stickers) {
    await drawSticker(ctx, sticker, size);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to export image'));
      },
      'image/jpeg',
      quality
    );
  });
}

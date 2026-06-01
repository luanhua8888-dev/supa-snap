import type { StickerPlacement } from '../lib/stickers';
import { MEME_TEXT_STICKERS, parseStickersJson } from '../lib/stickers';

function isMemeText(src: string) {
  return MEME_TEXT_STICKERS.some((m) => m.src === src);
}

export function SnapStickersDisplay({ json }: { json: string | null | undefined }) {
  const stickers = parseStickersJson(json);
  if (!stickers.length) return null;

  return (
    <>
      {stickers.map((sticker) => (
        <StickerItem key={sticker.id} sticker={sticker} />
      ))}
    </>
  );
}

function StickerItem({ sticker }: { sticker: StickerPlacement }) {
  const isMeme = isMemeText(sticker.src);
  const sizePct = `${sticker.scale * 100}%`;
  const fontBase = isMeme ? sticker.scale * 140 : sticker.scale * 280;

  return (
    <div
      className="absolute pointer-events-none z-[15] select-none"
      style={{
        left: `${sticker.x * 100}%`,
        top: `${sticker.y * 100}%`,
        width: sizePct,
        transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg)`,
      }}
    >
      {sticker.kind === 'emoji' || isMeme ? (
        <div style={{ fontSize: `${fontBase}cqw`, lineHeight: 1 }} className="w-full">
        <span
          className={`block w-full text-center leading-none ${
            isMeme ? 'font-extrabold text-pink-400 drop-shadow-[0_2px_0_#000]' : ''
          }`}
        >
          {sticker.src}
        </span>
        </div>
      ) : (
        <img
          src={sticker.src}
          alt=""
          className="w-full h-auto object-contain drop-shadow-md"
          draggable={false}
        />
      )}
    </div>
  );
}

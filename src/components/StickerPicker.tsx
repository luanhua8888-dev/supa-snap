import { useRef, useState } from 'react';
import { ImagePlus, Trash2, Sticker } from 'lucide-react';
import {
  BUILTIN_STICKERS,
  MEME_TEXT_STICKERS,
  createStickerPlacement,
  loadCustomStickers,
  removeCustomSticker,
  saveCustomSticker,
  type CustomStickerAsset,
  type StickerKind,
  type StickerPlacement,
} from '../lib/stickers';

interface StickerPickerProps {
  stickers: StickerPlacement[];
  onAdd: (placement: StickerPlacement) => void;
  disabled?: boolean;
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
      <div className="flex flex-nowrap gap-1.5 w-max">{children}</div>
    </div>
  );
}

export function StickerPicker({ stickers, onAdd, disabled }: StickerPickerProps) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const [custom, setCustom] = useState<CustomStickerAsset[]>(() => loadCustomStickers());

  const add = (src: string, kind: StickerKind) => {
    if (disabled) return;
    onAdd(createStickerPlacement(src, kind, stickers.length));
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result as string;
        const asset: CustomStickerAsset = {
          id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name.slice(0, 20),
          src,
          createdAt: Date.now(),
        };
        const next = saveCustomSticker(asset);
        setCustom(next);
        add(src, 'image');
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleRemoveCustom = (id: string) => {
    setCustom(removeCustomSticker(id));
  };

  return (
    <div className="w-full max-w-[370px] mt-2 space-y-2">
      <div className="flex items-center gap-1.5">
        <Sticker className="w-3.5 h-3.5 text-pink-400" />
        <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-wider">
          Sticker / GIF / Meme
        </span>
        <span className="text-[8px] text-zinc-600">· chạm chọn · kéo · chỉnh size</span>
      </div>

      <div>
        <span className="text-[8px] text-zinc-600 font-bold">Emoji</span>
        <div className="mt-1">
          <Row>
            {BUILTIN_STICKERS.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={disabled}
                onClick={() => add(s.src, 'emoji')}
                className="shrink-0 w-9 h-9 rounded-xl bg-white/8 border border-white/15 text-lg hover:scale-110 transition-transform cursor-pointer disabled:opacity-40"
                title={s.label}
              >
                {s.label}
              </button>
            ))}
          </Row>
        </div>
      </div>

      <div>
        <span className="text-[8px] text-zinc-600 font-bold">Meme chữ</span>
        <div className="mt-1">
          <Row>
            {MEME_TEXT_STICKERS.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={disabled}
                onClick={() => add(s.src, 'emoji')}
                className="shrink-0 min-w-[2.25rem] h-9 px-2 rounded-xl bg-pink-500/20 border border-pink-400/30 text-[10px] font-extrabold text-pink-200 hover:scale-105 cursor-pointer disabled:opacity-40"
              >
                {s.label}
              </button>
            ))}
          </Row>
        </div>
      </div>

      {custom.length > 0 && (
        <div>
          <span className="text-[8px] text-zinc-600 font-bold">Icon của bạn</span>
          <div className="mt-1">
            <Row>
              {custom.map((c) => (
                <div key={c.id} className="relative shrink-0 group">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => add(c.src, 'image')}
                    className="w-11 h-11 rounded-xl overflow-hidden border-2 border-white/20 hover:border-pink-400 cursor-pointer disabled:opacity-40"
                  >
                    <img src={c.src} alt="" className="w-full h-full object-cover" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustom(c.id)}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Xóa icon"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </Row>
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => uploadRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-extrabold font-rounded border border-dashed border-white/25 text-zinc-400 hover:text-white hover:border-pink-400/50 cursor-pointer disabled:opacity-40"
      >
        <ImagePlus className="w-4 h-4" />
        Tải ảnh / GIF làm icon (nhiều file)
      </button>
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}

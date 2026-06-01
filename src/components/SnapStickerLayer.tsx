import { useCallback, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { StickerPlacement } from '../lib/stickers';
import {
  clampStickerScale,
  isAnimatedStickerSrc,
  MEME_TEXT_STICKERS,
  STICKER_SCALE_MAX,
  STICKER_SCALE_MIN,
} from '../lib/stickers';

function isMemeText(src: string) {
  return MEME_TEXT_STICKERS.some((m) => m.src === src);
}

function clamp01(v: number, min = 0.06, max = 0.94) {
  return Math.min(max, Math.max(min, v));
}

function touchDistance(touches: { length: number; 0?: Touch; 1?: Touch }) {
  if (touches.length < 2 || !touches[0] || !touches[1]) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

interface SnapStickerLayerProps {
  stickers: StickerPlacement[];
  onChange: (stickers: StickerPlacement[]) => void;
  disabled?: boolean;
  selectedId?: string | null;
  onSelectId?: (id: string | null) => void;
}

interface StickerSizeControlsProps {
  sticker: StickerPlacement;
  onScaleChange: (scale: number) => void;
  disabled?: boolean;
}

export function StickerSizeControls({ sticker, onScaleChange, disabled }: StickerSizeControlsProps) {
  const nudge = (delta: number) => onScaleChange(clampStickerScale(sticker.scale + delta));

  return (
    <div className="w-full max-w-[370px] mx-auto mt-2 px-3 py-2 rounded-xl bg-white/[0.06] border border-white/10">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-wider">
          Kích thước sticker
        </span>
        <span className="text-[9px] font-mono text-pink-300">
          {Math.round(sticker.scale * 100)}%
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => nudge(-0.04)}
          className="shrink-0 w-8 h-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center cursor-pointer hover:bg-white/15 disabled:opacity-40"
          aria-label="Thu nhỏ"
        >
          <Minus className="w-4 h-4 text-white" />
        </button>
        <input
          type="range"
          disabled={disabled}
          min={STICKER_SCALE_MIN}
          max={STICKER_SCALE_MAX}
          step={0.01}
          value={sticker.scale}
          onChange={(e) => onScaleChange(clampStickerScale(parseFloat(e.target.value)))}
          className="flex-1 h-1.5 accent-pink-500 cursor-pointer disabled:opacity-40"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => nudge(0.04)}
          className="shrink-0 w-8 h-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center cursor-pointer hover:bg-white/15 disabled:opacity-40"
          aria-label="Phóng to"
        >
          <Plus className="w-4 h-4 text-white" />
        </button>
      </div>
      <p className="text-[8px] text-zinc-600 mt-1.5 text-center">
        Chạm chọn · kéo góc hồng · pinch 2 ngón · thanh trượt
      </p>
    </div>
  );
}

export function SnapStickerLayer({
  stickers,
  onChange,
  disabled,
  selectedId: selectedIdProp,
  onSelectId,
}: SnapStickerLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);
  const [selectedIdInternal, setSelectedIdInternal] = useState<string | null>(null);
  const selectedId = selectedIdProp ?? selectedIdInternal;
  const setSelectedId = onSelectId ?? setSelectedIdInternal;

  const updateSticker = useCallback(
    (id: string, patch: Partial<StickerPlacement>) => {
      onChange(stickers.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    },
    [onChange, stickers]
  );

  const removeSticker = (id: string) => {
    onChange(stickers.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleDragPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    sticker: StickerPlacement
  ) => {
    if (disabled) return;
    if ((e.target as HTMLElement).closest('[data-sticker-resize]')) return;

    e.preventDefault();
    e.stopPropagation();
    setSelectedId(sticker.id);

    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startX = sticker.x;
    const startY = sticker.y;

    const onMove = (ev: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const dx = (ev.clientX - startClientX) / rect.width;
      const dy = (ev.clientY - startClientY) / rect.height;

      updateSticker(sticker.id, {
        x: clamp01(startX + dx),
        y: clamp01(startY + dy),
      });
    };

    const onEnd = () => {
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  };

  const handleResizePointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    sticker: StickerPlacement
  ) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(sticker.id);

    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const startClientX = e.clientX;
    const startScale = sticker.scale;

    const onMove = (ev: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;

      const delta = (ev.clientX - startClientX) / rect.width;
      updateSticker(sticker.id, {
        scale: clampStickerScale(startScale + delta * 1.8),
      });
    };

    const onEnd = () => {
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  };

  const handleTouchStart = (e: React.TouchEvent, sticker: StickerPlacement) => {
    if (disabled || e.touches.length !== 2) return;
    e.stopPropagation();
    setSelectedId(sticker.id);
    pinchRef.current = { dist: touchDistance(e.touches), scale: sticker.scale };
  };

  const handleTouchMove = (e: React.TouchEvent, sticker: StickerPlacement) => {
    if (!pinchRef.current || e.touches.length !== 2) return;
    e.preventDefault();
    const dist = touchDistance(e.touches);
    if (pinchRef.current.dist <= 0) return;
    const ratio = dist / pinchRef.current.dist;
    updateSticker(sticker.id, {
      scale: clampStickerScale(pinchRef.current.scale * ratio),
    });
  };

  const handleTouchEnd = () => {
    pinchRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-30 touch-none"
      onPointerDown={() => setSelectedId(null)}
    >
      {stickers.map((sticker) => {
        const sizePct = `${sticker.scale * 100}%`;
        const isMeme = isMemeText(sticker.src);
        const isSelected = selectedId === sticker.id;
        const fontBase = isMeme ? sticker.scale * 140 : sticker.scale * 280;

        return (
          <div
            key={sticker.id}
            role="button"
            tabIndex={-1}
            onPointerDown={(e) => {
              e.stopPropagation();
              handleDragPointerDown(e, sticker);
            }}
            onTouchStart={(e) => handleTouchStart(e, sticker)}
            onTouchMove={(e) => handleTouchMove(e, sticker)}
            onTouchEnd={handleTouchEnd}
            onDoubleClick={(e) => {
              e.stopPropagation();
              removeSticker(sticker.id);
            }}
            className={`absolute select-none ${
              disabled ? 'pointer-events-none' : 'pointer-events-auto'
            } ${isSelected ? 'z-40' : 'z-30'}`}
            style={{
              left: `${sticker.x * 100}%`,
              top: `${sticker.y * 100}%`,
              width: sizePct,
              transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg)`,
            }}
          >
            <div
              className={`relative w-full cursor-grab active:cursor-grabbing ${
                isSelected
                  ? 'ring-2 ring-pink-400 rounded-lg shadow-[0_0_12px_rgba(236,72,153,0.45)]'
                  : ''
              }`}
              style={{ fontSize: `${fontBase}px`, lineHeight: 1 }}
            >
              {sticker.kind === 'emoji' || isMeme ? (
                <span
                  className={`block w-full text-center leading-none pointer-events-none ${
                    isMeme
                      ? 'font-extrabold text-pink-400 drop-shadow-[0_2px_0_#000]'
                      : ''
                  }`}
                >
                  {sticker.src}
                </span>
              ) : (
                <img
                  src={sticker.src}
                  alt=""
                  className="w-full h-auto object-contain drop-shadow-lg pointer-events-none"
                  draggable={false}
                />
              )}
              {isAnimatedStickerSrc(sticker.src) && (
                <span className="absolute -top-1 -right-1 text-[8px] bg-pink-500 text-white px-1 rounded font-bold pointer-events-none">
                  GIF
                </span>
              )}

              {isSelected && !disabled && (
                <button
                  type="button"
                  data-sticker-resize
                  aria-label="Chỉnh kích thước"
                  onPointerDown={(e) => handleResizePointerDown(e, sticker)}
                  className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-pink-500 border-2 border-white shadow-lg cursor-nwse-resize flex items-center justify-center pointer-events-auto touch-none"
                >
                  <span className="w-1.5 h-1.5 rounded-sm bg-white" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

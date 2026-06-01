import type { ReactNode } from 'react';
import { Palette } from 'lucide-react';
import {
  CAPTION_BG_PRESETS,
  CAPTION_TEXT_COLOR_PRESETS,
  CAPTION_TEXT_EFFECTS,
  getCaptionPreviewBg,
  getCaptionTextEffectClass,
  isGradientCss,
  needsMarqueeWrapper,
  resolveCaptionTextStyle,
  type CaptionBgStyle,
  type CaptionTextEffect,
} from '../lib/captionStyles';

interface CaptionStylePickerProps {
  caption: string;
  onCaptionChange: (v: string) => void;
  captionTextColor: string;
  onTextColorChange: (color: string) => void;
  captionBgStyle: CaptionBgStyle;
  onBgStyleChange: (style: CaptionBgStyle) => void;
  captionBgColor: string;
  onBgColorChange: (color: string) => void;
  captionTextEffect: CaptionTextEffect;
  onTextEffectChange: (fx: CaptionTextEffect) => void;
  compact?: boolean;
}

function HorizontalRow({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
      <div className="flex flex-nowrap gap-1.5 w-max min-w-full justify-start">{children}</div>
    </div>
  );
}

function SwatchButton({
  selected,
  onClick,
  title,
  background,
  children,
  shape = 'rounded-xl',
}: {
  selected: boolean;
  onClick: () => void;
  title?: string;
  background?: string;
  children?: ReactNode;
  shape?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`shrink-0 w-8 h-8 ${shape} text-sm border-2 transition-all cursor-pointer flex items-center justify-center overflow-hidden ${
        selected
          ? 'border-pink-400 ring-2 ring-pink-400/35 scale-105'
          : 'border-white/15 hover:border-white/45 hover:scale-105'
      }`}
      style={background ? { background } : undefined}
    >
      {children}
    </button>
  );
}

function CustomColorRow({
  value,
  onChange,
  placeholder,
  allowGradientHint,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  allowGradientHint?: boolean;
}) {
  const pickerValue = isGradientCss(value) ? '#ec4899' : value;

  return (
    <div className="flex items-center gap-2 mt-2 justify-center flex-wrap">
      <label className="relative shrink-0 cursor-pointer" title="Chọn màu">
        <span className="flex w-10 h-10 rounded-xl border-2 border-white/25 items-center justify-center bg-white/5 overflow-hidden">
          <Palette className="w-4 h-4 text-pink-300" />
        </span>
        <input
          type="color"
          value={pickerValue}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-[120px] max-w-[200px] px-2.5 py-1.5 rounded-lg text-[10px] font-mono bg-white/10 border border-white/15 text-white placeholder:text-zinc-500"
      />
      {allowGradientHint && (
        <span className="text-[8px] text-zinc-500 w-full text-center leading-tight">
          Dán gradient CSS hoặc chọn màu
        </span>
      )}
    </div>
  );
}

export function CaptionStylePicker({
  caption,
  onCaptionChange,
  captionTextColor,
  onTextColorChange,
  captionBgStyle,
  onBgStyleChange,
  captionBgColor,
  onBgColorChange,
  captionTextEffect,
  onTextEffectChange,
  compact = false,
}: CaptionStylePickerProps) {
  const bgGroups = [
    { id: 'solid', label: 'Cơ bản' },
    { id: 'gradient', label: 'Gradient' },
    { id: 'pastel', label: 'Pastel' },
  ] as const;

  const textGroups = [
    { id: 'classic', label: 'Cơ bản' },
    { id: 'pastel', label: 'Pastel' },
    { id: 'gradient', label: 'Gradient chữ' },
  ] as const;

  const previewTextStyle = resolveCaptionTextStyle(captionTextColor);

  return (
    <div className={`w-full space-y-2 px-1 max-w-[370px] ${compact ? 'mt-2' : 'mt-4'}`}>
      <div
        className="rounded-2xl border border-white/10 overflow-hidden"
        style={{ background: getCaptionPreviewBg(captionBgStyle, captionBgColor) }}
      >
        {needsMarqueeWrapper(captionTextEffect) ? (
          <div className="caption-marquee-wrap px-4 py-3">
            <input
              type="text"
              placeholder="Viết caption... 📝"
              value={caption}
              onChange={(e) => onCaptionChange(e.target.value)}
              maxLength={80}
              style={previewTextStyle}
              className={`w-full min-w-[200%] bg-transparent placeholder-white/35 font-rounded font-bold text-left text-sm focus:outline-none ${getCaptionTextEffectClass(captionTextEffect)}`}
            />
          </div>
        ) : (
          <input
            type="text"
            placeholder="Viết caption... 📝"
            value={caption}
            onChange={(e) => onCaptionChange(e.target.value)}
            maxLength={80}
            style={previewTextStyle}
            className={`w-full px-4 py-3 bg-transparent placeholder-white/35 font-rounded font-bold text-center text-sm focus:outline-none ${getCaptionTextEffectClass(captionTextEffect)}`}
          />
        )}
      </div>

      <div className="rounded-2xl bg-white/[0.04] border border-white/8 px-3 py-2.5 space-y-2.5">
        {/* Nền */}
        <div>
          <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-wider">Nền</span>
          {bgGroups.map((group) => {
            const items = CAPTION_BG_PRESETS.filter((p) => p.group === group.id);
            if (items.length === 0) return null;
            return (
              <div key={group.id} className="mt-1.5">
                <span className="text-[8px] text-zinc-600 font-bold">{group.label}</span>
                <div className="mt-1">
                  <HorizontalRow>
                    {items.map((opt) => (
                      <SwatchButton
                        key={opt.key}
                        selected={captionBgStyle === opt.key}
                        onClick={() => onBgStyleChange(opt.key)}
                        title={opt.key}
                        background={opt.key === 'none' || opt.key === 'custom' ? undefined : opt.preview}
                      >
                        {opt.key === 'none' || opt.key === 'custom' ? opt.label : ''}
                      </SwatchButton>
                    ))}
                  </HorizontalRow>
                </div>
              </div>
            );
          })}
          <div className="mt-1.5">
            <HorizontalRow>
              {CAPTION_BG_PRESETS.filter((p) => p.group === 'special').map((opt) => (
                <SwatchButton
                  key={opt.key}
                  selected={captionBgStyle === opt.key}
                  onClick={() => onBgStyleChange(opt.key)}
                  title={opt.key === 'custom' ? 'Tùy chỉnh' : 'Không nền'}
                >
                  {opt.label}
                </SwatchButton>
              ))}
            </HorizontalRow>
          </div>
          {captionBgStyle === 'custom' && (
            <CustomColorRow
              value={captionBgColor}
              onChange={onBgColorChange}
              placeholder="#ec4899 hoặc gradient..."
              allowGradientHint
            />
          )}
        </div>

        {/* Hiệu ứng chữ */}
        <div>
          <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-wider">
            Hiệu ứng chữ
          </span>
          <div className="mt-1.5">
            <HorizontalRow>
              {CAPTION_TEXT_EFFECTS.map((fx) => (
                <button
                  key={fx.key}
                  type="button"
                  title={fx.hint}
                  onClick={() => onTextEffectChange(fx.key)}
                  className={`shrink-0 w-8 h-8 rounded-xl text-sm border-2 transition-all cursor-pointer ${
                    captionTextEffect === fx.key
                      ? 'border-pink-400 bg-pink-500/20 ring-2 ring-pink-400/30'
                      : 'border-white/15 bg-white/5 hover:border-white/40'
                  }`}
                >
                  {fx.label}
                </button>
              ))}
            </HorizontalRow>
          </div>
        </div>

        {/* Màu chữ */}
        <div>
          <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-wider">
            Màu chữ
          </span>
          {textGroups.map((group) => {
            const items = CAPTION_TEXT_COLOR_PRESETS.filter((p) => p.group === group.id);
            return (
              <div key={group.id} className="mt-1.5">
                <span className="text-[8px] text-zinc-600 font-bold">{group.label}</span>
                <div className="mt-1">
                  <HorizontalRow>
                    {items.map((opt) => (
                      <SwatchButton
                        key={opt.value}
                        selected={captionTextColor === opt.value}
                        onClick={() => onTextColorChange(opt.value)}
                        background={opt.swatch}
                        shape="rounded-full"
                      />
                    ))}
                  </HorizontalRow>
                </div>
              </div>
            );
          })}
          <div className="mt-2">
            <span className="text-[8px] text-zinc-600 font-bold">Tùy chỉnh</span>
            <CustomColorRow
              value={captionTextColor}
              onChange={onTextColorChange}
              placeholder="#ffffff"
            />
          </div>
        </div>
      </div>

      <p className="text-center text-[9px] text-zinc-600 font-bold">{caption.length}/80</p>
    </div>
  );
}

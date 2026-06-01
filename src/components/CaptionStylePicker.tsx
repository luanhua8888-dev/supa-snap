import {
  CAPTION_BG_PRESETS,
  CAPTION_TEXT_COLORS,
  CAPTION_TEXT_EFFECTS,
  getCaptionPreviewBg,
  getCaptionTextEffectClass,
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
}: CaptionStylePickerProps) {
  return (
    <div className="w-full mt-4 space-y-2.5 px-1 max-w-[370px]">
      <div
        className="rounded-2xl border border-white/10 overflow-hidden"
        style={{ background: getCaptionPreviewBg(captionBgStyle, captionBgColor) }}
      >
        <input
          type="text"
          placeholder="Viết caption... 📝"
          value={caption}
          onChange={(e) => onCaptionChange(e.target.value)}
          maxLength={80}
          style={{ color: captionTextColor }}
          className={`w-full px-4 py-3 bg-transparent placeholder-white/35 font-rounded font-bold text-center text-sm focus:outline-none ${getCaptionTextEffectClass(captionTextEffect)}`}
        />
      </div>

      <div className="rounded-2xl bg-white/[0.04] border border-white/8 px-3 py-2.5 space-y-2.5 max-h-[200px] overflow-y-auto no-scrollbar">
        <div>
          <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-wider">Nền</span>
          <div className="flex flex-wrap gap-1.5 mt-1.5 justify-center">
            {CAPTION_BG_PRESETS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => onBgStyleChange(opt.key)}
                title={opt.key}
                className={`w-8 h-8 rounded-xl text-sm border-2 transition-all cursor-pointer flex items-center justify-center ${
                  captionBgStyle === opt.key
                    ? 'border-pink-400 ring-2 ring-pink-400/30 scale-105'
                    : 'border-white/15 hover:border-white/40'
                }`}
                style={
                  opt.swatch && opt.key !== 'none'
                    ? { background: opt.swatch }
                    : undefined
                }
              >
                {opt.key === 'none' || opt.key === 'custom' ? opt.label : ''}
              </button>
            ))}
          </div>
          {captionBgStyle === 'custom' && (
            <div className="flex items-center gap-2 mt-2 justify-center">
              <input
                type="color"
                value={captionBgColor}
                onChange={(e) => onBgColorChange(e.target.value)}
                className="w-10 h-10 rounded-xl border-0 cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={captionBgColor}
                onChange={(e) => onBgColorChange(e.target.value)}
                className="w-24 px-2 py-1 rounded-lg text-[10px] font-mono bg-white/10 border border-white/15 text-white"
              />
            </div>
          )}
        </div>

        <div>
          <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-wider">Hiệu ứng chữ</span>
          <div className="flex flex-wrap gap-1 mt-1.5 justify-center">
            {CAPTION_TEXT_EFFECTS.map((fx) => (
              <button
                key={fx.key}
                type="button"
                title={fx.hint}
                onClick={() => onTextEffectChange(fx.key)}
                className={`w-8 h-8 rounded-xl text-sm border-2 transition-all cursor-pointer ${
                  captionTextEffect === fx.key
                    ? 'border-pink-400 bg-pink-500/20 ring-2 ring-pink-400/30'
                    : 'border-white/15 bg-white/5 hover:border-white/40'
                }`}
              >
                {fx.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-wider">Màu chữ</span>
          <div className="flex flex-wrap gap-1.5 mt-1.5 justify-center items-center">
            {CAPTION_TEXT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onTextColorChange(color)}
                className={`w-7 h-7 rounded-full border-2 transition-all cursor-pointer ${
                  captionTextColor === color
                    ? 'border-pink-400 ring-2 ring-pink-400/30 scale-110'
                    : 'border-white/20 hover:scale-105'
                }`}
                style={{ background: color }}
              />
            ))}
            <input
              type="color"
              value={captionTextColor}
              onChange={(e) => onTextColorChange(e.target.value)}
              title="Màu tùy chỉnh"
              className="w-8 h-8 rounded-full border-2 border-white/30 cursor-pointer"
            />
          </div>
        </div>
      </div>

      <p className="text-center text-[9px] text-zinc-600 font-bold">{caption.length}/80</p>
    </div>
  );
}

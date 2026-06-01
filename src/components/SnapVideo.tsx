import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, ExternalLink } from 'lucide-react';
import { canBrowserPlayVideoUrl, mimeTypeFromVideoUrl } from '../lib/media';

interface SnapVideoProps {
  src: string;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  previewMode?: boolean;
  /** Detail lightbox — always try muted autoplay */
  detailMode?: boolean;
  onLoaded?: () => void;
  onError?: () => void;
}

export function SnapVideo({
  src,
  className = '',
  autoPlay = false,
  loop = true,
  previewMode = false,
  detailMode = false,
  onLoaded,
  onError,
}: SnapVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playAttempts = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);

  const shouldAutoplay = previewMode || autoPlay || detailMode;
  const mimeType = useMemo(() => mimeTypeFromVideoUrl(src), [src]);
  const unsupportedFormat = useMemo(() => !canBrowserPlayVideoUrl(src), [src]);

  const syncPlaying = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setIsPlaying(!v.paused && !v.ended);
  }, []);

  const tryPlay = useCallback(async () => {
    const v = videoRef.current;
    if (!v || unsupportedFormat) return;

    v.muted = true;
    v.playsInline = true;

    try {
      await v.play();
      setNeedsTap(false);
      setHasError(false);
      syncPlaying();
    } catch {
      playAttempts.current += 1;
      if (playAttempts.current < 4) {
        window.setTimeout(() => void tryPlay(), 200 * playAttempts.current);
      } else {
        setNeedsTap(true);
      }
    }
  }, [unsupportedFormat, syncPlaying]);

  useEffect(() => {
    playAttempts.current = 0;
    setHasError(false);
    setNeedsTap(false);
    setIsPlaying(false);

    if (unsupportedFormat) {
      setHasError(true);
      onError?.();
      return;
    }

    const v = videoRef.current;
    if (!v) return;

    const onReady = () => {
      onLoaded?.();
      if (shouldAutoplay) void tryPlay();
    };

    const onCanPlayThrough = () => {
      if (shouldAutoplay) void tryPlay();
    };

    v.addEventListener('loadeddata', onReady, { once: true });
    v.addEventListener('canplaythrough', onCanPlayThrough, { once: true });

    v.pause();
    v.load();

    return () => {
      v.removeEventListener('loadeddata', onReady);
      v.removeEventListener('canplaythrough', onCanPlayThrough);
    };
  }, [src, shouldAutoplay, tryPlay, unsupportedFormat, onLoaded, onError]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v || hasError || unsupportedFormat) return;

    if (v.paused || v.ended || needsTap) {
      v.muted = false;
      v.play().catch(() => {
        v.muted = true;
        void tryPlay();
      });
    } else {
      v.pause();
      setNeedsTap(true);
    }
  };

  if (!src) return null;

  if (unsupportedFormat) {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-white/90 px-4 text-center gap-2">
        <p className="text-[11px] font-semibold">Safari không phát WebM</p>
        <p className="text-[10px] text-zinc-400">Dùng Chrome hoặc quay lại bằng điện thoại (MP4)</p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-pink-300 underline mt-1"
          onClick={(e) => e.stopPropagation()}
        >
          Mở file video <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full cursor-pointer bg-black" onClick={handleClick}>
      <video
        ref={videoRef}
        playsInline
        muted
        loop={loop}
        preload="auto"
        autoPlay={shouldAutoplay}
        className={`snap-video w-full h-full object-cover ${className}`}
        onPlay={() => {
          setIsPlaying(true);
          setNeedsTap(false);
          syncPlaying();
        }}
        onPause={syncPlaying}
        onLoadedData={() => onLoaded?.()}
        onError={() => {
          setHasError(true);
          onError?.();
          onLoaded?.();
        }}
      >
        <source src={src} type={mimeType} />
      </video>

      {(needsTap || (!shouldAutoplay && !isPlaying && !hasError)) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20">
          <div className="w-14 h-14 rounded-full bg-black/55 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-lg">
            <Play className="w-7 h-7 text-white fill-white ml-0.5" />
          </div>
        </div>
      )}

      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/95 text-white/90 text-[11px] font-semibold px-4 text-center gap-2 pointer-events-none">
          <span>Không phát được video</span>
          <span className="text-[10px] text-zinc-400 font-normal">Bấm để thử lại hoặc mở link</span>
        </div>
      )}
    </div>
  );
}

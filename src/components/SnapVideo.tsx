import { useCallback, useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';

interface SnapVideoProps {
  src: string;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  onLoaded?: () => void;
}

export function SnapVideo({
  src,
  className = '',
  autoPlay = false,
  loop = true,
  onLoaded,
}: SnapVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayHint, setShowPlayHint] = useState(!autoPlay);

  const syncPlaying = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setIsPlaying(!v.paused && !v.ended);
    if (!v.paused) setShowPlayHint(false);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlay = () => {
      setIsPlaying(true);
      setShowPlayHint(false);
    };
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      if (loop) {
        v.play().catch(() => undefined);
      }
    };

    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('ended', onEnded);

    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('ended', onEnded);
    };
  }, [loop, src]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !autoPlay) return;

    const t = window.setTimeout(() => {
      v.muted = false;
      v.play().then(syncPlaying).catch(() => {
        v.muted = true;
        v.play().then(syncPlaying).catch(() => undefined);
      });
    }, 150);

    return () => clearTimeout(t);
  }, [autoPlay, src, syncPlaying]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;

    if (v.paused || v.ended) {
      v.muted = false;
      v.play().catch(() => {
        v.muted = true;
        v.play().catch(() => undefined);
      });
    } else {
      v.pause();
      setShowPlayHint(true);
    }
  };

  return (
    <div className="relative w-full h-full cursor-pointer" onClick={handleClick}>
      <video
        ref={videoRef}
        src={src}
        playsInline
        loop={loop}
        preload="auto"
        className={`snap-video w-full h-full object-cover ${className}`}
        onLoadedData={() => {
          onLoaded?.();
          syncPlaying();
        }}
      />

      {showPlayHint && !isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/15">
          <div className="w-14 h-14 rounded-full bg-black/45 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
            <Play className="w-7 h-7 text-white fill-white ml-0.5" />
          </div>
        </div>
      )}
    </div>
  );
}

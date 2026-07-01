import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Play } from 'lucide-react';
import { canBrowserPlayVideoUrl, mimeTypeFromVideoUrl, videoExtensionFromUrl } from '../lib/media';

interface DetailVideoPlayerProps {
  src: string;
  onLoaded?: () => void;
}

/** Detail view — full bleed video, no control bar, muted autoplay loop. */
export function DetailVideoPlayer({ src, onLoaded }: DetailVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [playSrc, setPlaySrc] = useState(src);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'unsupported'>('loading');
  const [needsTap, setNeedsTap] = useState(false);

  const ext = videoExtensionFromUrl(src);
  const unsupported = !canBrowserPlayVideoUrl(src);

  const tryPlay = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    try {
      await v.play();
      setNeedsTap(false);
    } catch {
      setNeedsTap(true);
    }
  }, []);

  useEffect(() => {
    setPlaySrc(src);
    setStatus(unsupported ? 'unsupported' : 'loading');
    setNeedsTap(false);

    if (unsupported) return;

    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(src, { mode: 'cors', cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        if (blob.size < 500) throw new Error('empty video');

        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const objectUrl = URL.createObjectURL(blob);
        blobUrlRef.current = objectUrl;
        setPlaySrc(objectUrl);
      } catch {
        if (!cancelled) setPlaySrc(src);
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [src, unsupported]);

  useEffect(() => {
    if (unsupported) return;
    const v = videoRef.current;
    if (!v) return;

    const onCanPlay = () => {
      setStatus('ready');
      onLoaded?.();
      void tryPlay();
    };

    const onError = () => setStatus('error');

    v.addEventListener('canplay', onCanPlay, { once: true });
    v.addEventListener('error', onError);

    return () => {
      v.removeEventListener('canplay', onCanPlay);
      v.removeEventListener('error', onError);
    };
  }, [playSrc, unsupported, onLoaded, tryPlay]);

  const handleTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v || status === 'error') return;

    if (v.paused || needsTap) {
      void tryPlay();
    } else {
      v.pause();
      setNeedsTap(true);
    }
  };

  if (unsupported) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black text-white px-4 text-center gap-2">
        <p className="text-sm font-semibold">Định dạng .{ext ?? 'video'} không hỗ trợ trên trình duyệt này</p>
        <p className="text-xs text-zinc-400">Quay snap mới trên điện thoại (MP4) hoặc mở bằng Chrome</p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-2 px-3 py-2 rounded-full bg-white/10 text-xs text-pink-200"
          onClick={(e) => e.stopPropagation()}
        >
          Mở video <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black text-white px-4 text-center gap-3">
        <p className="text-sm font-semibold">Không tải được video</p>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-500 text-white text-xs font-bold"
          onClick={(e) => {
            e.stopPropagation();
            setStatus('loading');
            setPlaySrc(src);
            videoRef.current?.load();
          }}
        >
          <Play className="w-4 h-4 fill-white" /> Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black cursor-pointer" onClick={handleTap}>
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="w-9 h-9 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {needsTap && status === 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center">
            <Play className="w-7 h-7 text-white fill-white ml-0.5" />
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        key={playSrc}
        src={playSrc}
        playsInline
        muted
        loop
        autoPlay
        preload="auto"
        controls={false}
        controlsList="nodownload noplaybackrate noremoteplayback"
        disablePictureInPicture
        disableRemotePlayback
        className="detail-video snap-video w-full h-full object-cover"
        onLoadedData={() => onLoaded?.()}
      >
        <source src={playSrc} type={mimeTypeFromVideoUrl(src)} />
      </video>
    </div>
  );
}

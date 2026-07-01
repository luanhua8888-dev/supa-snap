import { Music, Play } from 'lucide-react';
import { canBrowserPlayVideoUrl, isVideoMedia } from '../lib/media';
import type { PhotoData } from './PhotoCard';

interface GalleryThumbProps {
  photo: PhotoData;
  live?: boolean;
}

export function GalleryThumb({ photo, live }: GalleryThumbProps) {
  const isVideo = isVideoMedia(photo);
  const canPlay = !isVideo || canBrowserPlayVideoUrl(photo.image_url);

  return (
    <>
      {isVideo && canPlay ? (
        <video
          src={photo.image_url}
          muted
          playsInline
          preload="metadata"
          loop
          className="w-full h-full object-cover bg-zinc-900"
        />
      ) : isVideo ? (
        <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
          <Play className="w-6 h-6 text-white/70 fill-white/70" />
        </div>
      ) : (
        <img
          src={photo.image_url}
          alt={photo.caption || 'Snap'}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between z-10 pointer-events-none">
        {live ? (
          <div className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 ring-1 ring-white/30" />
          </div>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-1">
          {isVideo && (
            <div className="p-1 bg-black/55 backdrop-blur-md rounded-full border border-white/15">
              <Play className="w-2.5 h-2.5 text-white fill-white" />
            </div>
          )}
          {photo.song_title && (
            <div className="p-1 bg-black/55 backdrop-blur-md rounded-full border border-white/15">
              <Music className="w-2.5 h-2.5 text-pink-300" />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

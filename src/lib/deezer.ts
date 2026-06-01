export interface DeezerSong {
  title: string;
  artist: string;
  albumArt: string;
  previewUrl: string;
}

/** Deezer search via JSONP (no API key, works in browser). */
export function deezerSearch(query: string, limit = 8): Promise<DeezerSong[]> {
  return new Promise((resolve) => {
    const cbName = `_dz_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}&output=jsonp&callback=${cbName}`;

    const cleanup = () => {
      delete (window as unknown as Record<string, unknown>)[cbName];
      script.remove();
    };

    (window as unknown as Record<string, unknown>)[cbName] = (data: { data?: unknown[] }) => {
      cleanup();
      const items = Array.isArray(data?.data) ? data.data : [];
      resolve(items.map(parseDeezerTrack).filter(Boolean) as DeezerSong[]);
    };

    script.onerror = () => {
      cleanup();
      resolve([]);
    };
    script.src = url;
    document.head.appendChild(script);

    setTimeout(() => {
      cleanup();
      resolve([]);
    }, 8000);
  });
}

export function parseDeezerTrack(item: unknown): DeezerSong | null {
  const t = item as {
    preview?: string;
    title?: string;
    artist?: { name?: string };
    album?: { cover_medium?: string; cover?: string };
  };
  if (!t?.preview || !t?.title) return null;
  return {
    title: t.title,
    artist: t.artist?.name ?? '',
    albumArt: t.album?.cover_medium ?? t.album?.cover ?? '',
    previewUrl: t.preview,
  };
}

/** Find preview URL — tries several search queries. */
export async function fetchDeezerPreviewUrl(title: string, artist?: string | null): Promise<string | null> {
  const queries = [
    `${title} ${artist ?? ''}`.trim(),
    title.trim(),
    artist ? `${artist} ${title}`.trim() : '',
    // Romanized fallbacks for common tracks
    title.includes('エスプレッソ') || title.toLowerCase().includes('espresso')
      ? 'espresso sabrina carpenter'
      : '',
  ].filter((q, i, arr) => q && arr.indexOf(q) === i);

  for (const q of queries) {
    const tracks = await deezerSearch(q, 8);
    if (!tracks.length) continue;

    const exact = tracks.find(
      (t) =>
        t.title.toLowerCase() === title.toLowerCase() ||
        t.title.toLowerCase().includes(title.toLowerCase().slice(0, 8))
    );
    if (exact?.previewUrl) return exact.previewUrl;
    if (tracks[0]?.previewUrl) return tracks[0].previewUrl;
  }

  return null;
}

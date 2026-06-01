import { fetchDeezerPreviewUrl } from './deezer';

type MusicListener = (playing: boolean) => void;

let audio: HTMLAudioElement | null = null;
let blobUrl: string | null = null;
const listeners = new Set<MusicListener>();

function emit(playing: boolean) {
  listeners.forEach((fn) => fn(playing));
}

export function subscribeSnapMusic(fn: MusicListener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function isSnapMusicPlaying() {
  return !!audio && !audio.paused;
}

export function stopSnapMusic() {
  if (audio) {
    audio.pause();
    audio.onplay = null;
    audio.onpause = null;
    audio.onerror = null;
    audio = null;
  }
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl);
    blobUrl = null;
  }
  emit(false);
}

async function resolvePreviewUrl(
  previewUrl: string | null | undefined,
  title: string,
  artist?: string | null
): Promise<string | null> {
  if (previewUrl) return previewUrl;
  return fetchDeezerPreviewUrl(title, artist);
}

async function attachSrc(url: string): Promise<HTMLAudioElement> {
  stopSnapMusic();

  const el = new Audio();
  el.loop = true;
  el.volume = 0.5;
  el.preload = 'auto';

  el.onplay = () => emit(true);
  el.onpause = () => emit(false);
  el.onerror = () => emit(false);

  try {
    const res = await fetch(url, { mode: 'cors', cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    if (blob.size < 100) throw new Error('empty audio');
    blobUrl = URL.createObjectURL(blob);
    el.src = blobUrl;
  } catch {
    el.src = url;
  }

  audio = el;
  return el;
}

/** Play preview for a snap (stops any other snap music first). */
export async function playSnapMusic(
  previewUrl: string | null | undefined,
  title: string,
  artist?: string | null
): Promise<boolean> {
  if (!title?.trim()) return false;

  let url = await resolvePreviewUrl(previewUrl, title, artist);
  if (!url) return false;

  try {
    const el = await attachSrc(url);
    await el.play();
    return true;
  } catch {
    const fresh = await fetchDeezerPreviewUrl(title, artist);
    if (!fresh || fresh === url) return false;
    try {
      const el = await attachSrc(fresh);
      await el.play();
      return true;
    } catch {
      stopSnapMusic();
      return false;
    }
  }
}

export function toggleSnapMusic(
  previewUrl: string | null | undefined,
  title: string,
  artist?: string | null
): Promise<boolean> {
  if (isSnapMusicPlaying()) {
    stopSnapMusic();
    return Promise.resolve(false);
  }
  return playSnapMusic(previewUrl, title, artist);
}

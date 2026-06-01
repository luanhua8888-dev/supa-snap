export type MediaType = 'image' | 'video';

const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/gif',
]);

const VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

/** MIME types allowed by the Supabase `photos` bucket (must match storage config). */
export const STORAGE_ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;

export function isVideoMedia(photo: { media_type?: string | null; image_url?: string }): boolean {
  if (photo.media_type === 'video') return true;
  if (photo.media_type === 'image') return false;
  const url = photo.image_url?.toLowerCase() ?? '';
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

export function videoExtensionFromUrl(url: string): string | null {
  const path = url.split('?')[0]?.toLowerCase() ?? '';
  const m = path.match(/\.(mp4|webm|mov|m4v)$/i);
  return m ? m[1] : null;
}

export function mimeTypeFromVideoUrl(url: string): string {
  const ext = videoExtensionFromUrl(url);
  if (ext === 'mp4' || ext === 'm4v') return 'video/mp4';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'mov') return 'video/quicktime';
  return 'video/mp4';
}

/** Can this browser decode the file at `url`? (Safari often cannot play WebM.) */
export function canBrowserPlayVideoUrl(url: string): boolean {
  if (typeof document === 'undefined') return true;
  const probe = document.createElement('video');
  const ext = videoExtensionFromUrl(url);
  if (ext === 'webm') {
    return probe.canPlayType('video/webm') === 'probably';
  }
  if (ext === 'mp4' || ext === 'm4v') {
    const t = probe.canPlayType('video/mp4');
    return t === 'probably' || t === 'maybe';
  }
  if (ext === 'mov') {
    return (
      probe.canPlayType('video/quicktime') === 'probably' ||
      probe.canPlayType('video/mp4') === 'probably'
    );
  }
  return true;
}

export function detectMediaTypeFromBlob(blob: Blob): MediaType {
  return blob.type.startsWith('video/') ? 'video' : 'image';
}

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v']);

export function fileVideoExtension(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext && VIDEO_EXTENSIONS.has(ext) ? ext : null;
}

export function detectMediaTypeFromFile(file: File): MediaType {
  if (file.type.startsWith('video/')) return 'video';
  if (fileVideoExtension(file)) return 'video';
  return 'image';
}

export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent);
}

export function isMediaRecorderSupported(): boolean {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return false;
  try {
    if (pickVideoRecorderMimeType()) return true;
    return typeof MediaRecorder !== 'undefined';
  } catch {
    return false;
  }
}

/** Mobile-safe camera constraints (4096 ideal often fails on phones). */
export function getCameraVideoConstraints(facingMode: 'user' | 'environment'): MediaTrackConstraints {
  if (isMobileDevice()) {
    return {
      facingMode,
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 1280, max: 1920 },
    };
  }
  return {
    facingMode,
    width: { ideal: 1920, max: 4096 },
    height: { ideal: 1920, max: 4096 },
  };
}

/** iOS gallery/camera files often have empty `type` — infer from name. */
export function mimeTypeFromFile(file: File, mediaType: MediaType): string {
  const base = normalizeMimeType(file.type);
  if (mediaType === 'image') {
    if (IMAGE_MIMES.has(base)) return base;
    return 'image/jpeg';
  }
  if (VIDEO_MIMES.has(base)) return base;
  const ext = fileVideoExtension(file);
  if (ext === 'mp4' || ext === 'm4v') return 'video/mp4';
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'webm') return 'video/webm';
  return isMobileDevice() ? 'video/mp4' : 'video/webm';
}

/** Ensure blob has a MIME before upload (recorded clips on iOS may omit type). */
export function ensureBlobMime(blob: Blob, mediaType: MediaType): Blob {
  if (normalizeMimeType(blob.type)) return blob;
  const type =
    blob instanceof File
      ? mimeTypeFromFile(blob, mediaType)
      : mediaType === 'video'
        ? isMobileDevice()
          ? 'video/mp4'
          : 'video/webm'
        : 'image/jpeg';
  return new Blob([blob], { type });
}

/** Pick best MediaRecorder mime for this browser (mp4 first — better for iOS + Supabase). */
export function pickVideoRecorderMimeType(): string | null {
  const candidates = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  const found = candidates.find((m) => MediaRecorder.isTypeSupported(m));
  return found ?? null;
}

/** Base MIME without codecs (Supabase rejects `video/webm;codecs=vp9,opus`). */
export function normalizeMimeType(mime: string): string {
  return mime.split(';')[0]?.trim().toLowerCase() || '';
}

export function extensionForUpload(blob: Blob, mediaType: MediaType): string {
  if (mediaType === 'video') {
    const base = normalizeMimeType(blob.type);
    if (base === 'video/mp4') return 'mp4';
    if (base === 'video/quicktime') return 'mov';
    if (blob instanceof File) {
      const ext = fileVideoExtension(blob);
      if (ext === 'mp4' || ext === 'm4v') return 'mp4';
      if (ext === 'mov') return 'mov';
      if (ext === 'webm') return 'webm';
    }
    return isMobileDevice() ? 'mp4' : 'webm';
  }
  return 'jpg';
}

export function contentTypeForUpload(blob: Blob, mediaType: MediaType): string {
  if (blob instanceof File) return mimeTypeFromFile(blob, mediaType);
  const base = normalizeMimeType(blob.type);

  if (mediaType === 'image') {
    if (IMAGE_MIMES.has(base)) return base;
    return 'image/jpeg';
  }

  if (VIDEO_MIMES.has(base)) return base;
  return isMobileDevice() ? 'video/mp4' : 'video/webm';
}

export function isStorageMimeError(message: string): boolean {
  return /mime type/i.test(message) && /not supported/i.test(message);
}

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

export function detectMediaTypeFromBlob(blob: Blob): MediaType {
  return blob.type.startsWith('video/') ? 'video' : 'image';
}

export function detectMediaTypeFromFile(file: File): MediaType {
  return file.type.startsWith('video/') ? 'video' : 'image';
}

/** Pick best MediaRecorder mime for this browser (mp4 first — better for iOS + Supabase). */
export function pickVideoRecorderMimeType(): string {
  const candidates = [
    'video/mp4',
    'video/mp4;codecs=avc1,mp4a',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/quicktime',
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
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
    return 'webm';
  }
  return 'jpg';
}

export function contentTypeForUpload(blob: Blob, mediaType: MediaType): string {
  const base = normalizeMimeType(blob.type);

  if (mediaType === 'image') {
    if (IMAGE_MIMES.has(base)) return base;
    return 'image/jpeg';
  }

  if (VIDEO_MIMES.has(base)) return base;
  return 'video/webm';
}

export function isStorageMimeError(message: string): boolean {
  return /mime type/i.test(message) && /not supported/i.test(message);
}

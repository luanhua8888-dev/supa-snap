/** Fingerprint blob media to detect duplicate uploads. */
export async function blobFingerprint(blob: Blob): Promise<string> {
  const head = await blob.slice(0, Math.min(blob.size, 64 * 1024)).arrayBuffer();
  let hex = '';
  if (typeof crypto !== 'undefined' && crypto.subtle?.digest) {
    const digest = await crypto.subtle.digest('SHA-256', head);
    hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 24);
  } else {
    hex = `${blob.size}-${head.byteLength}`;
  }
  return `${blob.type || 'bin'}:${blob.size}:${hex}`;
}

const recent = new Map<string, number>();
const WINDOW_MS = 3 * 60 * 1000;

/** Returns true if this blob was already posted recently (same session / few minutes). */
export function isDuplicateUpload(fingerprint: string): boolean {
  const now = Date.now();
  for (const [key, ts] of recent) {
    if (now - ts > WINDOW_MS) recent.delete(key);
  }
  return recent.has(fingerprint);
}

export function markUploadPosted(fingerprint: string) {
  recent.set(fingerprint, Date.now());
}

// Client-side mirror of apps/common/files.py — magic-byte verification.
// The server re-validates every upload, so this is a UX guard, not a security boundary.

export type FileCheckResult = { ok: true } | { ok: false; error: string };

const FILE_SIGNATURES: Record<string, number[][]> = {
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].map((b) => [b]),
  jpg: [[0xff, 0xd8, 0xff]],
  pdf: [[0x25, 0x50, 0x44, 0x46]], // %PDF
};

const MAX_SIG_LEN = 8;

const EXT_LABELS: Record<string, string> = {
  png: 'PNG',
  jpg: 'JPG',
  jpeg: 'JPG',
  pdf: 'PDF',
  webp: 'WEBP',
};

export function allowedExtensions(allowedTypes: string[]): string {
  const seen: string[] = [];
  for (const t of allowedTypes) {
    const label = EXT_LABELS[t];
    if (label && !seen.includes(label)) seen.push(label);
  }
  return seen.join(', ');
}

function readHead(file: File, bytes = MAX_SIG_LEN): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.onload = () => {
      const result = reader.result;
      if (!(result instanceof ArrayBuffer)) {
        reject(new Error('Failed to read file'));
        return;
      }
      resolve(new Uint8Array(result.slice(0, bytes)));
    };
    reader.readAsArrayBuffer(file);
  });
}

function startsWith(head: Uint8Array, sig: number[]): boolean {
  if (head.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (head[i] !== sig[i]) return false;
  }
  return true;
}

function matchesSignature(head: Uint8Array, type: string): boolean {
  if (type === 'webp') {
    return startsWith(head, [0x52, 0x49, 0x46, 0x46]) && startsWith(head.slice(8), [0x57, 0x45, 0x42, 0x50]);
  }
  const signatures = FILE_SIGNATURES[type];
  return signatures?.some((sig) => startsWith(head, sig)) ?? true;
}

function hasAllowedExtension(file: File, allowedTypes: string[]): boolean {
  const name = file.name.toLowerCase();
  return allowedTypes.some((t) => name.endsWith(`.${t}`));
}

export async function validateUploadedFile(
  file: File,
  allowedTypes: string[],
  label: string,
  maxSizeMb = 5,
): Promise<FileCheckResult> {
  if (!file) return { ok: true };

  if (file.size > maxSizeMb * 1024 * 1024) {
    return { ok: false, error: `${label} must be ${maxSizeMb} MB or smaller.` };
  }

  if (!hasAllowedExtension(file, allowedTypes)) {
    return {
      ok: false,
      error: `${label} is not a valid file. Only ${allowedExtensions(allowedTypes)} files are allowed.`,
    };
  }

  try {
    const head = await readHead(file);
    const matches = allowedTypes.some((t) => matchesSignature(head, t));
    if (!matches) {
      return {
        ok: false,
        error: `${label} is not a valid file. Only ${allowedExtensions(allowedTypes)} files are allowed.`,
      };
    }
  } catch {
    return { ok: false, error: `${label} could not be read. Please try again.` };
  }

  return { ok: true };
}

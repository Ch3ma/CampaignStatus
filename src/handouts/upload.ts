import { fileMatches, type HandoutMime } from './model.ts';

import { inlineHandoutBytes } from './limits.ts';

const mimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'] as const;

export type CheckedHandout = {
  name: string;
  mime: HandoutMime;
  bytes: Uint8Array<ArrayBuffer>;
};

export async function inspectHandoutFile(file: File, limit = inlineHandoutBytes): Promise<CheckedHandout> {
  if (file.size === 0 || file.size > limit) {
    const label = limit >= 1024 * 1024 ? `${limit / (1024 * 1024)} MiB` : `${limit / 1024} KiB`;
    throw new Error(`Elige un archivo que tenga contenido y no supere ${label}.`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = mimeTypes.find((type) => fileMatches(bytes, type));
  if (!mime || (file.type && file.type.toLowerCase() !== mime)) {
    throw new Error('La firma del archivo no coincide con un PNG, JPEG, WebP o PDF válido.');
  }
  return { name: file.name, mime, bytes };
}

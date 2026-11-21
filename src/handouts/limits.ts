export const inlineHandoutBytes = 100 * 1024;
const mebibyte = 1024 * 1024;
export const maxStorageBytes = 128 * mebibyte;
export const defaultStorageBytes = 64 * mebibyte;
export const envelopeOverhead = 28;

export function storageLimit(value: string | undefined) {
  const bytes = Number(value) * mebibyte;
  return Number.isInteger(bytes / mebibyte) && bytes >= mebibyte && bytes <= maxStorageBytes ? bytes : defaultStorageBytes;
}

export function cellStorageLimit(value: unknown) {
  if (value === undefined) return defaultStorageBytes;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < mebibyte || value > maxStorageBytes) {
    throw new Error('El límite de almacenamiento de la célula no es válido.');
  }
  return value;
}

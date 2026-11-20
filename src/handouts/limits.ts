export const inlineHandoutBytes = 100 * 1024;
const mebibyte = 1024 * 1024;
export const maxStorageBytes = 32 * mebibyte;
export const envelopeOverhead = 28;

export function storageLimit(value: string | undefined) {
  const mib = Number(value ?? 20);
  return Number.isInteger(mib) && mib >= 1 && mib <= 32 ? mib * mebibyte : 20 * mebibyte;
}

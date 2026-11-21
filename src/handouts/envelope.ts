const ivSize = 12;

export function mediaContext(cell: string, handout: string, version: string, mime: string) {
  return new TextEncoder().encode(JSON.stringify([cell, handout, version, mime]));
}

export async function sourceDigest(bytes: Uint8Array<ArrayBuffer>) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createKey() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
}

async function importKey(value: string, usage: KeyUsage) {
  const bytes = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, [usage]);
}

export async function encryptFile(bytes: Uint8Array<ArrayBuffer>, value: string, context: Uint8Array<ArrayBuffer>) {
  const iv = crypto.getRandomValues(new Uint8Array(ivSize));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: context }, await importKey(value, 'encrypt'), bytes,
  ));
  const envelope = new Uint8Array(iv.length + ciphertext.length);
  envelope.set(iv);
  envelope.set(ciphertext, iv.length);
  return envelope;
}

export async function decryptFile(bytes: ArrayBuffer, value: string, context: Uint8Array<ArrayBuffer>) {
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(bytes, 0, ivSize), additionalData: context },
    await importKey(value, 'decrypt'), new Uint8Array(bytes, ivSize),
  );
}

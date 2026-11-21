import { deleteObject, getBytes, getMetadata, ref, uploadBytesResumable } from 'firebase/storage';
import { cellId } from '../domain';
import { storage } from '../firebase';
import { decryptFile, encryptFile, mediaContext, sourceDigest } from './envelope';
import { envelopeOverhead, maxStorageBytes, storageLimit } from './limits';
import type { CloudVersion, HandoutMime } from './model';

export const uploadLimit = storageLimit(import.meta.env.VITE_HANDOUT_MAX_MIB);

function objectRef(handoutId: string, versionId: string) {
  if (!storage) throw new Error('El almacenamiento multimedia no está configurado.');
  return ref(storage, `cell-handouts/${cellId}/${handoutId}/${versionId}/content`);
}

function notFound(error: unknown) {
  return error instanceof Error && 'code' in error && error.code === 'storage/object-not-found';
}

export async function readCloudFile(
  handoutId: string, versionId: string, mime: HandoutMime, size: number, key: string,
) {
  if (!Number.isSafeInteger(size) || size <= 0 || size > maxStorageBytes) {
    throw new Error('El tamaño registrado está fuera del límite compatible.');
  }
  const sealed = await getBytes(objectRef(handoutId, versionId), size + envelopeOverhead);
  if (sealed.byteLength !== size + envelopeOverhead) throw new Error('La longitud del archivo no coincide.');
  return new Uint8Array(await decryptFile(sealed, key, mediaContext(cellId, handoutId, versionId, mime)));
}

export async function uploadCloudFile(
  handoutId: string, version: CloudVersion, key: string, bytes: Uint8Array<ArrayBuffer>,
  signal: AbortSignal, progress: (percent: number) => void,
) {
  if (bytes.length !== version.byteLength || await sourceDigest(bytes) !== version.sourceHash) {
    throw new Error('Selecciona la misma copia que inició esta carga.');
  }
  signal.throwIfAborted();
  try {
    // A prior attempt may have completed the object before confirming its metadata.
    const stored = await readCloudFile(handoutId, version.id, version.mime, version.byteLength, key);
    if (await sourceDigest(stored) !== version.sourceHash) throw new Error('El objeto guardado no corresponde al borrador.');
    progress(100);
    return;
  } catch (error) {
    if (!notFound(error)) throw error;
  }
  signal.throwIfAborted();
  const envelope = await encryptFile(bytes, key, mediaContext(cellId, handoutId, version.id, version.mime));
  signal.throwIfAborted();
  const task = uploadBytesResumable(objectRef(handoutId, version.id), envelope, {
    contentType: 'application/octet-stream', contentDisposition: 'attachment', cacheControl: 'private, no-store',
  });
  const abort = () => task.cancel();
  signal.addEventListener('abort', abort, { once: true });
  const unsubscribe = task.on('state_changed', (snapshot) => {
    progress(Math.round(100 * snapshot.bytesTransferred / snapshot.totalBytes));
  });
  try {
    const result = await task;
    if (result.metadata.size !== envelope.byteLength) throw new Error('La carga guardada tiene un tamaño incorrecto.');
  } finally {
    unsubscribe();
    signal.removeEventListener('abort', abort);
  }
}

export async function verifyCloudObject(handoutId: string, versionId: string, size: number) {
  const metadata = await getMetadata(objectRef(handoutId, versionId)).catch((error: unknown) => {
    if (notFound(error)) throw new Error('El archivo guardado no está disponible. Selecciona una copia para reemplazarlo.');
    throw error;
  });
  if (metadata.size !== size + envelopeOverhead) throw new Error('El archivo guardado tiene un tamaño incorrecto.');
}

export async function deletePendingFile(handoutId: string, versionId: string) {
  try {
    await deleteObject(objectRef(handoutId, versionId));
  } catch (error) {
    if (!notFound(error)) throw error;
  }
}

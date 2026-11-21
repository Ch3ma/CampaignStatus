import { createKey, sourceDigest } from './envelope';
import { cellStorageLimit } from './limits';
import { deletePendingFile, readCloudFile, uploadCloudFile, verifyCloudObject } from './storage';
import type { CheckedHandout } from './upload';
import {
  Bytes, collection, doc, getDocFromServer, getDocsFromServer, onSnapshot, query, runTransaction,
  serverTimestamp, where, writeBatch, type DocumentData, type DocumentReference,
} from 'firebase/firestore';
import { cellId } from '../domain';
import { database, isDemo, recordVersion, RecordChangedError, storage } from '../firebase';
import {
  fileMatches, playerCanSeeTarget, relationKinds, relationSlots, visibleRelationSlots, emptyRelations, emptyCloud,
  type Handout, type HandoutFields, type LinkedRecord, type Provenance, type Relation, type RelationFields, type CloudVersion,
} from './model';

const collectionRef = () => collection(database(), 'cells', cellId, 'handouts');
const recordRef = (id: string) => doc(collectionRef(), id);
const provenanceRef = (target: DocumentReference) => doc(target, 'private', 'provenance');
const versionRef = (target: DocumentReference, id: string) => doc(target, 'versions', id);
const keyRef = (target: DocumentReference, id: string) => doc(target, 'keys', id);
const relationRef = (target: DocumentReference, slot: string) => doc(target, 'relations', slot);

function fromDocument(id: string, data: DocumentData): Handout {
  return {
    id, version: recordVersion(data.updatedAt), title: data.title, category: data.category, summary: data.summary,
    narrativeDate: data.narrativeDate, tags: data.tags, classification: data.classification, alt: data.alt,
    downloadAllowed: data.downloadAllowed, mime: data.mime, byteLength: data.byteLength, status: data.status, cloud: data.cloud ?? null,
  };
}

export function watchHandouts(handling: boolean, ready: (records: Handout[] | null) => void, fail: () => void) {
  const source = handling ? collectionRef() : query(collectionRef(), where('status', '==', 'published'));
  return onSnapshot(source, { includeMetadataChanges: true }, (snapshot) => {
    if (snapshot.metadata.fromCache) return ready(null);
    if (!snapshot.metadata.hasPendingWrites) {
      ready(snapshot.docs.map((item) => fromDocument(item.id, item.data()))
        .sort((a, b) => a.title.localeCompare(b.title, 'es')));
    }
  }, fail);
}

async function getKey(id: string, revision: string) {
  const value: unknown = (await getDocFromServer(keyRef(recordRef(id), revision))).data()?.key;
  if (typeof value !== 'string') throw new Error('Falta la clave del archivo.');
  return value;
}

export async function getHandoutFile(handout: Pick<Handout, 'id' | 'mime' | 'byteLength' | 'cloud'>) {
  let bytes: Uint8Array<ArrayBuffer>;
  const version = handout.cloud?.active;
  if (version) {
    const key = await getKey(handout.id, version);
    bytes = await readCloudFile(handout.id, version, handout.mime, handout.byteLength, key);
  } else {
    if (!isDemo) throw new Error('La ficha no tiene un archivo disponible.');
    const snapshot = await getDocFromServer(doc(recordRef(handout.id), 'files', 'preview'));
    const stored: unknown = snapshot.data()?.bytes;
    if (!(stored instanceof Bytes)) throw new Error('El archivo no está disponible.');
    bytes = new Uint8Array(stored.toUint8Array());
  }
  if (bytes.length !== handout.byteLength || !fileMatches(bytes, handout.mime)) {
    throw new Error('El archivo no coincide con su ficha.');
  }
  return new Blob([bytes], { type: handout.mime });
}

function targetRecord(edge: Relation) {
  return doc(database(), 'cells', cellId, edge.kind, edge.targetId);
}

export function watchRelations(id: string, simulatePlayer: boolean, receive: (links: LinkedRecord[]) => void) {
  const results = new Map<string, LinkedRecord>();
  const targetStops = new Map<string, () => void>();
  const report = (slot: string, data?: LinkedRecord) => {
    if (data) results.set(slot, data);
    else results.delete(slot);
    receive(relationSlots.flatMap((name) => {
      const link = results.get(name);
      return link ? [link] : [];
    }));
  };
  function clear(slot: string) {
    targetStops.get(slot)?.();
    targetStops.delete(slot);
    report(slot);
  }
  const edgeStops = relationSlots.map((slot) => onSnapshot(
    doc(recordRef(id), 'relations', slot), { includeMetadataChanges: true }, (edgeSnapshot) => {
      clear(slot);
      const data = edgeSnapshot.data();
      if (edgeSnapshot.metadata.fromCache || !data || !relationKinds.includes(data.kind)) return;
      const edge: Relation = { kind: data.kind, targetId: data.targetId };
      const stop = onSnapshot(targetRecord(edge), { includeMetadataChanges: true }, (target) => {
        const active = target.data();
        if (target.metadata.fromCache || !active || (simulatePlayer && !playerCanSeeTarget(edge.kind, active))) {
          report(slot);
          return;
        }
        report(slot, { ...edge, title: active.title });
      }, () => report(slot));
      targetStops.set(slot, stop);
    }, () => clear(slot),
  ));
  return () => {
    edgeStops.forEach((stop) => stop());
    targetStops.forEach((stop) => stop());
  };
}

export async function getProvenance(id: string) {
  const snapshot = await getDocFromServer(provenanceRef(recordRef(id)));
  const data = snapshot.data() as Provenance | undefined;
  if (!data) return null;
  const references = await Promise.all(data.references.map(async (edge) => {
    const target = await getDocFromServer(targetRecord(edge));
    return { ...edge, title: target.data()?.title ?? edge.targetId };
  }));
  return { ...data, references };
}

export async function getRelationsForEdit(id: string): Promise<RelationFields> {
  const target = recordRef(id);
  const [provenance, operation, ...visible] = await Promise.all([
    getDocFromServer(provenanceRef(target)),
    ...relationSlots.map((slot) => getDocFromServer(relationRef(target, slot))),
  ]);
  return {
    operationId: operation.data()?.targetId ?? '',
    visible: visible.flatMap((entry) => entry.exists() ? [entry.data() as Relation] : []),
    provenance: (provenance.data() as Provenance | undefined) ?? emptyRelations.provenance,
  };
}

type RelationWriter = {
  set(ref: DocumentReference, data: DocumentData): unknown;
  delete(ref: DocumentReference): unknown;
};

function writeRelations(writer: RelationWriter, target: DocumentReference, data: RelationFields, editing: boolean) {
  writer.set(provenanceRef(target), data.provenance);
  writer.set(relationRef(target, 'operation'), { kind: 'operations', targetId: data.operationId });
  for (const [index, slot] of visibleRelationSlots.entries()) {
    const link = data.visible[index];
    if (link) writer.set(relationRef(target, slot), link);
    else if (editing) writer.delete(relationRef(target, slot));
  }
}

async function pendingVersion(target: DocumentReference, file: CheckedHandout) {
  const policy = (await getDocFromServer(doc(database(), 'cells', cellId, 'handoutPolicy', 'sources'))).data();
  const blocked: unknown = policy?.blockedHashes;
  if (!Array.isArray(blocked) || blocked.length === 0) throw new Error('Configura la política de fuentes reservadas.');
  const limit = cellStorageLimit(policy?.maxBytes);
  if (file.bytes.length > limit) {
    throw new Error(`El límite de la célula es de ${limit / (1024 * 1024)} MiB por archivo.`);
  }
  const sourceHash = await sourceDigest(file.bytes);
  if (blocked.includes(sourceHash)) throw new Error('Este archivo pertenece a las fuentes reservadas.');
  const revision = doc(collection(target, 'versions')).id;
  return {
    id: revision, key: createKey(),
    data: { mime: file.mime, byteLength: file.bytes.length, sourceHash, status: 'pending', createdAt: serverTimestamp() },
  };
}

function writePending(writer: RelationWriter, target: DocumentReference, pending: Awaited<ReturnType<typeof pendingVersion>>) {
  writer.set(versionRef(target, pending.id), pending.data);
  writer.set(keyRef(target, pending.id), { key: pending.key });
}

export async function createHandout(fields: HandoutFields, relations: RelationFields, file: CheckedHandout, uid: string) {
  if (!storage) throw new Error('El almacenamiento multimedia no está configurado.');
  const target = doc(collectionRef());
  const pending = await pendingVersion(target, file);
  const batch = writeBatch(database());
  batch.set(target, {
    ...fields, mime: file.mime, byteLength: file.bytes.length, status: 'draft',
    cloud: { ...emptyCloud, pending: pending.id, pendingBytes: pending.data.byteLength },
    createdAt: serverTimestamp(), createdBy: uid, updatedAt: serverTimestamp(), publishedAt: null, publishedBy: '',
  });
  writePending(batch, target, pending);
  writeRelations(batch, target, relations, false);
  await batch.commit();
  return { id: target.id, revision: pending.id };
}

export async function stageReplacement(handout: Handout, file: CheckedHandout) {
  const target = recordRef(handout.id);
  const pending = await pendingVersion(target, file);
  const cloud = handout.cloud ?? emptyCloud;
  if (cloud.pending || cloud.cleanup) throw new Error('Completa o descarta la carga pendiente.');
  await runTransaction(database(), async (transaction) => {
    const data = (await transaction.get(target)).data();
    if (!data || recordVersion(data.updatedAt) !== handout.version) throw new RecordChangedError();
    transaction.update(target, {
      cloud: { ...cloud, pending: pending.id, pendingBytes: pending.data.byteLength },
      status: handout.status === 'published' ? 'review' : handout.status, updatedAt: serverTimestamp(),
    });
    writePending(transaction, target, pending);
  });
  return pending.id;
}

export async function completeUpload(
  id: string, revision: string, file: CheckedHandout, signal: AbortSignal, progress: (percent: number) => void,
) {
  const target = recordRef(id);
  const versionData = (await getDocFromServer(versionRef(target, revision))).data();
  if (!versionData || versionData.status !== 'pending') throw new RecordChangedError();
  const version = { ...versionData, id: revision } as CloudVersion;
  const present = (await getDocFromServer(target)).data();
  if (present?.cloud?.pending !== revision) throw new RecordChangedError();
  if (present.cloud.pendingBytes === undefined) {
    // Bind the expected size of a legacy pending revision without changing its key or object.
    await runTransaction(database(), async (transaction) => {
      const current = (await transaction.get(target)).data();
      if (current?.cloud?.pending !== revision) throw new RecordChangedError();
      if (current.cloud.pendingBytes === undefined) {
        transaction.update(target, { 'cloud.pendingBytes': version.byteLength, updatedAt: serverTimestamp() });
      }
    });
  }
  signal.throwIfAborted();
  await uploadCloudFile(id, version, await getKey(id, revision), file.bytes, signal, progress);
  signal.throwIfAborted();
  await runTransaction(database(), async (transaction) => {
    const data = (await transaction.get(target)).data();
    if (!data || data.cloud?.pending !== revision) throw new RecordChangedError();
    transaction.update(versionRef(target, revision), { status: 'ready' });
    transaction.update(target, {
      cloud: { ...emptyCloud, active: revision }, mime: version.mime, byteLength: version.byteLength,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function discardUpload(handout: Handout) {
  const target = recordRef(handout.id);
  const cloud = handout.cloud;
  const id = cloud?.cleanup || cloud?.pending;
  if (!cloud || !id) return;
  if (cloud.pending) {
    await runTransaction(database(), async (transaction) => {
      const current = (await transaction.get(target)).data();
      if (current?.cloud?.pending !== id) throw new RecordChangedError();
      transaction.update(target, { cloud: { ...emptyCloud, active: cloud.active, cleanup: id }, updatedAt: serverTimestamp() });
      transaction.update(versionRef(target, id), { status: 'discarding' });
    });
  }
  await deletePendingFile(handout.id, id);
  await runTransaction(database(), async (transaction) => {
    const current = (await transaction.get(target)).data();
    if (current?.cloud?.cleanup !== id) throw new RecordChangedError();
    transaction.update(target, { cloud: { ...emptyCloud, active: cloud.active }, updatedAt: serverTimestamp() });
    transaction.update(versionRef(target, id), { status: 'discarded' });
  });
}

export async function getReadyVersions(id: string) {
  const snapshots = await getDocsFromServer(query(collection(recordRef(id), 'versions'), where('status', '==', 'ready')));
  return snapshots.docs.map((doc) => ({
    ...doc.data(), id: doc.id, createdAt: doc.data().createdAt.toMillis(),
  } as CloudVersion & { createdAt: number })).sort((a, b) => b.createdAt - a.createdAt);
}

export async function restoreVersion(handout: Handout, version: CloudVersion) {
  await verifyCloudObject(handout.id, version.id, version.byteLength);
  const target = recordRef(handout.id);
  await runTransaction(database(), async (transaction) => {
    const current = (await transaction.get(target)).data();
    if (!current || recordVersion(current.updatedAt) !== handout.version) throw new RecordChangedError();
    transaction.update(target, {
      cloud: { ...emptyCloud, active: version.id }, mime: version.mime, byteLength: version.byteLength,
      status: handout.status === 'published' ? 'review' : handout.status, updatedAt: serverTimestamp(),
    });
  });
}

export async function updateHandout(
  handout: Handout, update: HandoutFields | 'published' | 'archived' | 'draft', uid: string, relations?: RelationFields,
) {
  if (update === 'published' && handout.cloud?.active) {
    await verifyCloudObject(handout.id, handout.cloud.active, handout.byteLength);
  }
  if (relations && !isDemo && !handout.cloud) throw new Error('La edición de referencias requiere emuladores locales.');
  const target = recordRef(handout.id);
  await runTransaction(database(), async (transaction) => {
    const current = (await transaction.get(target)).data();
    if (!current || recordVersion(current.updatedAt) !== handout.version) throw new RecordChangedError();
    const publishing = update === 'published';
    const fields = typeof update === 'string' ? { status: update } : {
      ...update, status: current.status === 'published' ? 'review' : current.status,
    };
    transaction.update(target, {
      ...fields, updatedAt: serverTimestamp(),
      ...(publishing ? { publishedAt: serverTimestamp(), publishedBy: uid } : {}),
    });
    if (relations) writeRelations(transaction, target, relations, true);
  });
}

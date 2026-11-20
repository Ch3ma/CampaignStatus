import type { CheckedHandout } from './upload';
import {
  Bytes, collection, doc, getDocFromServer, onSnapshot, query, runTransaction,
  serverTimestamp, where, writeBatch, type DocumentData, type DocumentReference,
} from 'firebase/firestore';
import { cellId } from '../domain';
import { database, isDemo, recordVersion, RecordChangedError } from '../firebase';
import {
  fileMatches, playerCanSeeTarget, relationKinds, relationSlots, visibleRelationSlots, emptyRelations,
  type Handout, type HandoutFields, type LinkedRecord, type Provenance, type Relation, type RelationFields,
} from './model';

const collectionRef = () => collection(database(), 'cells', cellId, 'handouts');
const recordRef = (id: string) => doc(collectionRef(), id);
const provenanceRef = (target: DocumentReference) => doc(target, 'private', 'provenance');
const relationRef = (target: DocumentReference, slot: string) => doc(target, 'relations', slot);

function fromDocument(id: string, data: DocumentData): Handout {
  return {
    id, version: recordVersion(data.updatedAt), title: data.title, category: data.category, summary: data.summary,
    narrativeDate: data.narrativeDate, tags: data.tags, classification: data.classification, alt: data.alt,
    downloadAllowed: data.downloadAllowed, mime: data.mime, byteLength: data.byteLength, status: data.status,
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

export async function getHandoutFile(handout: Pick<Handout, 'id' | 'mime' | 'byteLength'>) {
  if (!isDemo) throw new Error('El visor de prueba requiere emuladores.');
  const snapshot = await getDocFromServer(doc(recordRef(handout.id), 'files', 'preview'));
  const stored: unknown = snapshot.data()?.bytes;
  if (!(stored instanceof Bytes)) throw new Error('El archivo no está disponible.');
  const bytes = new Uint8Array(stored.toUint8Array());
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

export async function createHandout(fields: HandoutFields, relations: RelationFields, file: CheckedHandout, uid: string) {
  if (!isDemo) throw new Error('La carga requiere emuladores locales.');
  const target = doc(collectionRef());
  const batch = writeBatch(database());
  batch.set(target, {
    ...fields, mime: file.mime, byteLength: file.bytes.length, status: 'draft',
    createdAt: serverTimestamp(), createdBy: uid, updatedAt: serverTimestamp(), publishedAt: null, publishedBy: '',
  });
  batch.set(doc(target, 'files', 'preview'), { bytes: Bytes.fromUint8Array(file.bytes) });
  writeRelations(batch, target, relations, false);
  await batch.commit();
  return target.id;
}

export async function updateHandout(
  handout: Handout, update: HandoutFields | 'published' | 'archived' | 'draft', uid: string, relations?: RelationFields,
) {
  if (relations && !isDemo) throw new Error('La edición de referencias requiere emuladores locales.');
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

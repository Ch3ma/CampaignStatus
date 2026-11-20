import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, initializeAuth, inMemoryPersistence } from 'firebase/auth';
import {
  addDoc, collection, connectFirestoreEmulator, doc, getDocFromServer, initializeFirestore,
  memoryLocalCache, onSnapshot, query, runTransaction, serverTimestamp, Timestamp, where,
  type DocumentData, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import {
  cellId, demoProject, safePhoto, type ArchiveRecord, type Collection, type Membership,
  type RecordFields, type Role,
} from './domain';

const env = import.meta.env;
export const isDemo = env.DEV && env.VITE_USE_EMULATORS === 'true';
const config = isDemo ? { apiKey: 'demo-key', projectId: demoProject } : {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const app = Object.values(config).every(Boolean) ? initializeApp(config) : null;
export const auth = app ? initializeAuth(app, { persistence: inMemoryPersistence }) : null;
const db = app ? initializeFirestore(app, { localCache: memoryLocalCache() }) : null;

if (isDemo && auth && db) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

function database() {
  if (!db) throw new Error('Firestore no está configurado.');
  return db;
}

export function watchMembership(
  uid: string,
  receive: (membership: Membership | null | undefined) => void,
  fail: () => void,
) {
  return onSnapshot(doc(database(), 'cells', cellId, 'members', uid), { includeMetadataChanges: true },
    (snapshot) => {
      if (snapshot.metadata.fromCache) {
        receive(undefined);
        return;
      }
      const data = snapshot.data();
      receive(data && (data.role === 'handler' || data.role === 'agent') && typeof data.alias === 'string'
        ? { role: data.role, alias: data.alias } : null);
    }, fail);
}

export async function getCellName() {
  const snapshot = await getDocFromServer(doc(database(), 'cells', cellId));
  const name: unknown = snapshot.data()?.name;
  return typeof name === 'string' ? name : 'Cell A';
}

function archiveRecord(snapshot: QueryDocumentSnapshot<DocumentData>): ArchiveRecord {
  const data = snapshot.data();
  return {
    id: snapshot.id, title: data.title, category: data.category, summary: data.summary,
    body: data.body, tags: data.tags, photo: safePhoto(data.photo), connections: data.connections,
    stage: data.stage, status: data.status, audience: data.audience, recipientUid: data.recipientUid,
    publishedAt: data.publishedAt?.toMillis() ?? null, publishedBy: data.publishedBy,
    version: recordVersion(data.updatedAt),
  };
}

export function watchRecords(
  section: Collection,
  scope: 'published' | 'management',
  uid: string,
  role: Role,
  receive: (records: ArchiveRecord[] | null) => void,
  fail: () => void,
) {
  const ref = collection(database(), 'cells', cellId, section);
  const published = where('status', '==', 'published');
  const queries = scope === 'management' ? [query(ref)]
    : role === 'handler' ? [query(ref, published)]
    : section === 'messages' ? [
      query(ref, published, where('audience', '==', 'cell')),
      query(ref, published, where('audience', '==', 'direct'), where('recipientUid', '==', uid)),
    ] : [query(ref, published, where('audience', '==', 'cell'))];

  const results = queries.map<ArchiveRecord[] | null>(() => null);
  let failed = false;
  const subscriptions = queries.map((request, index) => onSnapshot(request, { includeMetadataChanges: true },
    (snapshot) => {
      if (failed || (scope === 'management' && snapshot.metadata.hasPendingWrites && !snapshot.metadata.fromCache)) return;
      results[index] = snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites
        ? null : snapshot.docs.map(archiveRecord);
      if (results.some((result) => result === null)) {
        receive(null);
        return;
      }
      receive(results.flatMap((result) => result ?? []).sort(
        (a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0) || a.title.localeCompare(b.title, 'es'),
      ));
    }, () => {
      failed = true;
      fail();
    }));
  return () => subscriptions.forEach((unsubscribe) => unsubscribe());
}

function recordVersion(updatedAt: unknown) {
  return updatedAt instanceof Timestamp ? updatedAt.valueOf() : '';
}

export class RecordChangedError extends Error {}

export async function saveRecord(section: Collection, values: RecordFields, uid: string, record?: ArchiveRecord) {
  const ref = collection(database(), 'cells', cellId, section);
  const audit = values.status === 'published' ? { publishedAt: serverTimestamp(), publishedBy: uid }
    : record ? {} : { publishedAt: null, publishedBy: '' };
  const fields = { ...values, title: values.title.trim(), ...audit, updatedAt: serverTimestamp() };
  if (!record) {
    await addDoc(ref, fields);
    return;
  }
  const target = doc(ref, record.id);
  await runTransaction(database(), async (transaction) => {
    const current = await transaction.get(target);
    if (!current.exists() || recordVersion(current.data().updatedAt) !== record.version) {
      throw new RecordChangedError();
    }
    transaction.update(target, fields);
  });
}

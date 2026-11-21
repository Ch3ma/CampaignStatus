import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDocFromServer, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { deleteObject, getBytes, getDownloadURL, getStorage, listAll, ref, uploadBytes, connectStorageEmulator } from 'firebase/storage';
import { createUserWithEmailAndPassword, connectAuthEmulator, getAuth, signOut } from 'firebase/auth';
import { deleteApp, initializeApp } from 'firebase/app';

const projectId = 'demo-black-archive';
const cell = 'cells/media-test';
const id = 'h'.repeat(20);
const path = `${cell}/handouts/${id}`;
const first = 'a'.repeat(20);
const replacement = 'c'.repeat(20);
const second = 'b'.repeat(20);
const cloud = { active: '', pending: '', cleanup: '' };
const sourceHash = '5'.repeat(64);
const blockedHash = '7'.repeat(64);
const key = Buffer.alloc(32, 8).toString('base64');
const length = 2 * 1024 * 1024;
const opaqueBytes = new Uint8Array(length + 28).fill(27);
const metadata = { contentType: 'application/octet-stream', contentDisposition: 'attachment', cacheControl: 'private, no-store' };
let env;
let externalApp;
let externalStorage;

const bucketPath = (revision, cellId = 'media-test') => `cell-handouts/${cellId}/${id}/${revision}/content`;
const asset = (user, revision, cellId) => ref(user.storage(), bucketPath(revision, cellId));

function finish(db, revision, size = length) {
  const parent = doc(db, path);
  const batch = writeBatch(db);
  batch.update(doc(parent, 'versions', revision), { status: 'ready' });
  batch.update(parent, { cloud: { ...cloud, active: revision }, byteLength: size, updatedAt: serverTimestamp() });
  return batch.commit();
}

function stage(db, revision, existing, hash = sourceHash, size = length, declared = size) {
  const batch = writeBatch(db);
  const parent = doc(db, path);
  if (existing) batch.update(parent, { cloud: { ...cloud, active: first, pending: revision, pendingBytes: declared }, status: 'review', updatedAt: serverTimestamp() });
  else {
    batch.set(parent, {
      title: 'Archivo sintético', category: '', summary: '', tags: '', narrativeDate: '', classification: 'RESTRICTED',
      alt: 'Prueba', downloadAllowed: false, mime: 'application/pdf', byteLength: size,
      status: 'draft', cloud: { ...cloud, pending: revision, pendingBytes: declared }, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      createdBy: 'media-handler', publishedAt: null, publishedBy: '',
    });
    batch.set(doc(parent, 'relations', 'operation'), { kind: 'operations', targetId: 'open' });
    batch.set(doc(parent, 'private', 'provenance'), {
      document: 'Privado', page: '1', section: '', supportingPages: '', adaptationNotes: '',
      references: [{ kind: 'dossiers', targetId: 'reserved' }],
    });
  }
  batch.set(doc(parent, 'versions', revision), { mime: 'application/pdf', byteLength: size, sourceHash: hash, status: 'pending', createdAt: serverTimestamp() });
  batch.set(doc(parent, 'keys', revision), { key });
  return batch.commit();
}

before(async () => {
  env = await initializeTestEnvironment({ projectId });
  externalApp = initializeApp({ projectId, apiKey: 'demo-key', storageBucket: `${projectId}.appspot.com` });
  const auth = getAuth(externalApp);
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
  await createUserWithEmailAndPassword(auth, 'external-storage-test@example.test', 'StorageTestOnly123');
  externalStorage = getStorage(externalApp);
  const host = new URL(`http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`);
  connectStorageEmulator(externalStorage, host.hostname, Number(host.port));
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all(Object.entries({
      [`${cell}/members/media-handler`]: { role: 'handler', alias: 'Handler' },
      [`${cell}/members/media-agent`]: { role: 'agent', alias: 'Agent' },
      'cells/other/members/media-outsider': { role: 'handler', alias: 'Otro Handler' },
      [`${cell}/operations/open`]: { status: 'published', audience: 'cell' },
      [`${cell}/handoutPolicy/sources`]: { blockedHashes: [blockedHash], maxBytes: 40 * 1024 * 1024 },
    }).map(([path, data]) => setDoc(doc(db, path), data)));
  });
});

after(async () => {
  if (externalApp) {
    await signOut(getAuth(externalApp));
    await deleteApp(externalApp);
  }
  await env?.cleanup();
});

test('Storage allows versioned uploads by the Handler and releases bytes and keys only while published', async () => {
  const handler = env.authenticatedContext('media-handler');
  const agent = env.authenticatedContext('media-agent');
  const guest = env.unauthenticatedContext();
  const outsider = env.authenticatedContext('media-outsider');
  const db = handler.firestore();
  const parent = doc(db, path);
  const publish = () => updateDoc(parent, {
    status: 'published', publishedAt: serverTimestamp(), publishedBy: 'media-handler', updatedAt: serverTimestamp(),
  });
  await assertFails(stage(db, first, false, blockedHash));
  await assertFails(stage(db, first, false, sourceHash, 41 * 1024 * 1024));
  await assertFails(stage(db, first, false, sourceHash, length, length + 1));
  await assertSucceeds(stage(db, first, false));
  await assertFails(publish());
  await assertFails(uploadBytes(asset(agent, first), opaqueBytes, metadata));
  await assertFails(uploadBytes(asset(outsider, first), opaqueBytes, metadata));
  await assertFails(uploadBytes(asset(handler, second), opaqueBytes, metadata));
  await assertFails(uploadBytes(asset(handler, first), opaqueBytes, { ...metadata, contentType: 'application/pdf' }));
  await assertFails(uploadBytes(asset(handler, first), opaqueBytes, { ...metadata, customMetadata: { source: 'hidden' } }));
  await assertFails(uploadBytes(asset(handler, first), new Uint8Array(length + 29), metadata));
  await assertSucceeds(uploadBytes(asset(handler, first), opaqueBytes, metadata));
  await assertFails(uploadBytes(asset(handler, first), opaqueBytes, metadata));
  await assertFails(deleteObject(asset(handler, first)));
  await assertFails(listAll(ref(agent.storage(), `cell-handouts/media-test/${id}`)));

  const agentRecord = (...parts) => getDocFromServer(doc(agent.firestore(), path, ...parts));
  await assertFails(agentRecord('keys', first));
  await assertFails(getBytes(asset(agent, first)));
  await assertSucceeds(getBytes(asset(handler, first)));

  await assertSucceeds(finish(db, first));
  await assertSucceeds(publish());
  await assertSucceeds(getBytes(asset(agent, first)));
  await assertSucceeds(agentRecord('keys', first));
  await assertFails(agentRecord('versions', first));
  await assertFails(agentRecord('private', 'provenance'));
  await assertFails(getBytes(asset(guest, first)));
  await assertFails(getBytes(asset(outsider, first)));
  await assertFails(getBytes(ref(externalStorage, bucketPath(first))));
  await assertFails(getBytes(asset(handler, first, 'other')));

  const tokenUrl = await assertSucceeds(getDownloadURL(asset(handler, first)));
  const withoutToken = new URL(tokenUrl);
  withoutToken.searchParams.delete('token');
  assert.equal((await fetch(withoutToken)).status, 403);
  const largeSize = 33 * 1024 * 1024;
  await assertSucceeds(stage(db, second, true, sourceHash, largeSize));
  await assertSucceeds(uploadBytes(asset(handler, second), new Uint8Array(largeSize + 28), metadata));
  await assertFails(getBytes(asset(agent, second)));
  await assertFails(agentRecord('keys', second));
  const cancel = writeBatch(db);
  cancel.update(parent, { cloud: { ...cloud, active: first, cleanup: second }, updatedAt: serverTimestamp() });
  cancel.update(doc(parent, 'versions', second), { status: 'discarding' });
  await assertSucceeds(cancel.commit());
  await assertSucceeds(deleteObject(asset(handler, second)));
  await assertFails(deleteObject(asset(handler, first)));
  const cleanup = writeBatch(db);
  cleanup.update(parent, { cloud: { ...cloud, active: first }, updatedAt: serverTimestamp() });
  cleanup.update(doc(parent, 'versions', second), { status: 'discarded' });
  await assertSucceeds(cleanup.commit());
  await assertSucceeds(stage(db, replacement, true));
  await assertSucceeds(uploadBytes(asset(handler, replacement), opaqueBytes, metadata));
  await assertSucceeds(finish(db, replacement));
  await assertSucceeds(publish());
  await assertSucceeds(getBytes(asset(agent, replacement)));
  await assertSucceeds(agentRecord('keys', replacement));
  await assertFails(getBytes(asset(agent, first)));
  await assertFails(agentRecord('keys', first));
  await assertSucceeds(getBytes(asset(handler, first)));
  await assertSucceeds(updateDoc(parent, { status: 'archived', updatedAt: serverTimestamp() }));
  await assertFails(getBytes(asset(agent, replacement)));
  await assertFails(agentRecord('keys', replacement));
  await assertFails(getBytes(asset(agent, first)));
  await assertFails(agentRecord('keys', first));
  // An authorized metadata reader may recover an SDK token. It serves only the opaque envelope.
  assert.deepEqual(new Uint8Array(await (await fetch(tokenUrl)).arrayBuffer()), opaqueBytes);
});

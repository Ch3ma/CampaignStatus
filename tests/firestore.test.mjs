import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  Bytes, collection, connectFirestoreEmulator, deleteDoc, doc, getDocFromServer, getDocsFromServer, getFirestore,
  query, setDoc, updateDoc, where, serverTimestamp, Timestamp, terminate,
} from 'firebase/firestore';

import { demoImage } from '../scripts/demo-image.mjs';
import { demoPdf } from '../scripts/demo-pdf.mjs';

const projectId = 'demo-black-archive';
const cell = 'cells/cell-a';
const record = (status = 'published', extra = {}) => ({
  title: 'Registro de prueba', category: '', summary: '', body: '', tags: '', photo: '',
  stage: '', connections: '', status, audience: 'cell', recipientUid: '',
  updatedAt: serverTimestamp(), publishedAt: status === 'published' ? serverTimestamp() : null,
  publishedBy: status === 'published' ? 'handler' : '', ...extra,
});
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId, firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const fixtures = {
      [cell]: { name: 'Cell A' },
      [`${cell}/members/agent`]: { role: 'agent', alias: 'Agente' },
      [`${cell}/members/handler`]: { role: 'handler', alias: 'Handler' },
      [`${cell}/dossiers/public`]: record(),
      [`${cell}/dossiers/draft`]: record('draft'),
      [`${cell}/dossiers/unclassified`]: { title: 'Estado sin asignar' },
      [`${cell}/operations/future`]: record('review'),
      [`${cell}/personnel/archived`]: record('archived'),
      [`${cell}/handlerNotes/private`]: { notes: 'Material interno ficticio' },
      [`${cell}/messages/cell`]: record(),
      [`${cell}/messages/own`]: record('published', { audience: 'direct', recipientUid: 'agent' }),
      [`${cell}/messages/other`]: record('published', { audience: 'direct', recipientUid: 'other' }),
      [`${cell}/messages/draft`]: record('draft', { audience: 'direct', recipientUid: 'agent' }),
      'cells/cell-b/dossiers/public': record(),
    };
    await Promise.all(Object.entries(fixtures).map(([path, data]) => setDoc(doc(db, path), data)));
  });
});

after(async () => { await env?.cleanup(); });

test('guest and authenticated users without membership cannot read cell data', async () => {
  for (const context of [env.unauthenticatedContext(), env.authenticatedContext('nonmember')]) {
    await assertFails(getDocFromServer(doc(context.firestore(), `${cell}/dossiers/public`)));
    await assertFails(getDocFromServer(doc(context.firestore(), cell)));
  }
});

test('agent can use published query, cannot enumerate drafts or another cell', async () => {
  const db = env.authenticatedContext('agent').firestore();
  const dossiers = collection(db, `${cell}/dossiers`);
  const visible = query(dossiers, where('status', '==', 'published'), where('audience', '==', 'cell'));
  assert.deepEqual((await assertSucceeds(getDocsFromServer(visible))).docs.map(({ id }) => id), ['public']);
  await assertFails(getDocsFromServer(dossiers));
  for (const path of [`${cell}/dossiers/draft`, `${cell}/dossiers/unclassified`, `${cell}/operations/future`, `${cell}/personnel/archived`,
    `${cell}/handlerNotes/private`, 'cells/cell-b/dossiers/public']) {
    await assertFails(getDocFromServer(doc(db, path)));
  }
});

test('agent sees a direct message only for its UID and only once published', async () => {
  const db = env.authenticatedContext('agent').firestore();
  const messages = collection(db, `${cell}/messages`);
  const published = where('status', '==', 'published');
  const cellMessages = query(messages, published, where('audience', '==', 'cell'));
  const ownMessages = query(messages, published, where('audience', '==', 'direct'), where('recipientUid', '==', 'agent'));
  assert.deepEqual((await assertSucceeds(getDocsFromServer(cellMessages))).docs.map(({ id }) => id), ['cell']);
  assert.deepEqual((await assertSucceeds(getDocsFromServer(ownMessages))).docs.map(({ id }) => id), ['own']);
  await assertFails(getDocsFromServer(query(messages, published, where('audience', '==', 'direct'))));
  await assertFails(getDocFromServer(doc(messages, 'other')));
  await assertFails(getDocFromServer(doc(messages, 'draft')));
});

test('members are read-only even if their token claims a handler role', async () => {
  const db = env.authenticatedContext('agent', { role: 'handler' }).firestore();
  await assertFails(updateDoc(doc(db, `${cell}/members/agent`), { role: 'handler' }));
  await assertFails(setDoc(doc(db, `${cell}/dossiers/new`), record('draft')));
  await assertFails(updateDoc(doc(db, `${cell}/dossiers/public`), { title: 'Alterado' }));
  await assertFails(updateDoc(doc(db, `${cell}/dossiers/draft`), { status: 'published' }));
  await assertFails(setDoc(doc(db, `${cell}/handlerNotes/fake`), { notes: 'Prueba' }));
  const handler = env.authenticatedContext('handler').firestore();
  await assertFails(setDoc(doc(handler, `${cell}/members/new-user`), { role: 'handler', alias: 'Otro' }));
});

test('handler can release and withdraw a record with verified audit fields', async () => {
  const handler = env.authenticatedContext('handler').firestore();
  const agent = env.authenticatedContext('agent').firestore();
  const path = `${cell}/dossiers/release`;
  const writable = doc(handler, path);
  const readable = doc(agent, path);
  await assertSucceeds(getDocFromServer(doc(handler, `${cell}/handlerNotes/private`)));
  await assertSucceeds(setDoc(writable, record('draft')));
  await assertFails(getDocFromServer(readable));
  await assertFails(updateDoc(writable, { ...record(), publishedBy: 'agent' }));
  await assertFails(updateDoc(writable, { ...record(), handlerNotes: 'Secreto' }));
  await assertFails(updateDoc(writable, { ...record(), publishedAt: Timestamp.fromMillis(0) }));
  await assertSucceeds(updateDoc(writable, record()));
  assert.equal((await assertSucceeds(getDocFromServer(readable))).data().publishedBy, 'handler');
  await assertSucceeds(updateDoc(writable, { status: 'archived', updatedAt: serverTimestamp() }));
  await assertFails(getDocFromServer(readable));
  await assertFails(setDoc(doc(handler, 'cells/cell-b/dossiers/new'), record('draft')));
});

test('real Firebase Auth Emulator grants access only after verified membership', async () => {
  const email = 'integration@example.test';
  const password = 'emulator-integration-only';
  const signup = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  assert.equal(signup.ok, true);
  const app = initializeApp({ apiKey: 'demo-key', projectId }, 'integration');
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    const dossier = doc(db, `${cell}/dossiers/public`);
    await assertFails(getDocFromServer(dossier));
    await env.withSecurityRulesDisabled((context) => setDoc(
      doc(context.firestore(), `${cell}/members/${user.uid}`), { role: 'agent', alias: 'Integración' },
    ));
    await assertSucceeds(getDocFromServer(dossier));
    await env.withSecurityRulesDisabled((context) => deleteDoc(doc(context.firestore(), `${cell}/members/${user.uid}`)));
    await assertFails(getDocFromServer(dossier));
  } finally {
    await terminate(db);
    await deleteApp(app);
  }
});

test('handout bytes, provenance and links respect publication and target permissions', async () => {
  const handler = env.authenticatedContext('handler').firestore();
  const agent = env.authenticatedContext('agent').firestore();
  const outsider = env.authenticatedContext('nonmember').firestore();
  const guest = env.unauthenticatedContext().firestore();
  const path = `${cell}/handouts/demo-image`;
  const image = demoImage();
  const draft = {
    title: 'Imagen sintética', category: 'Prueba', summary: '', narrativeDate: '', tags: '',
    classification: 'RESTRICTED', alt: 'Señal ficticia', downloadAllowed: false, mime: 'image/png',
    byteLength: image.length, status: 'draft', createdAt: serverTimestamp(), createdBy: 'handler',
    publishedAt: null, publishedBy: '', updatedAt: serverTimestamp(),
  };
  const publication = {
    status: 'published', publishedAt: serverTimestamp(), publishedBy: 'handler', updatedAt: serverTimestamp(),
  };
  await assertFails(setDoc(doc(handler, path), { ...draft, ...publication }));
  await assertFails(setDoc(doc(handler, path), { ...draft, relationCount: 1 }));
  await assertFails(setDoc(doc(agent, path), draft));
  await assertSucceeds(setDoc(doc(handler, path), draft));
  await assertFails(updateDoc(doc(handler, path), publication));
  await assertFails(setDoc(doc(handler, path, 'files', 'preview'), { bytes: Bytes.fromUint8Array(image) }));

  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, cell, 'operations', 'handout-operation'), record()),
      setDoc(doc(db, path, 'files', 'preview'), { bytes: Bytes.fromUint8Array(image) }),
      setDoc(doc(db, path, 'private', 'provenance'), { document: 'Fuente de prueba', references: [{ kind: 'dossiers', targetId: 'draft' }] }),
      setDoc(doc(db, path, 'relations', 'r1'), { kind: 'dossiers', targetId: 'public' }),
      setDoc(doc(db, path, 'relations', 'r2'), { kind: 'dossiers', targetId: 'draft' }),
      setDoc(doc(db, path, 'relations', 'operation'), { kind: 'operations', targetId: 'handout-operation' }),
    ]);
  });

  const read = (db, ...parts) => getDocFromServer(doc(db, path, ...parts));
  const published = query(collection(agent, cell, 'handouts'), where('status', '==', 'published'));
  await assertSucceeds(read(handler, 'files', 'preview'));
  assert.equal((await assertSucceeds(read(handler, 'private', 'provenance'))).data().references[0].targetId, 'draft');
  assert.equal((await assertSucceeds(read(handler, 'relations', 'r1'))).data().targetId, 'public');
  assert.equal((await assertSucceeds(getDocsFromServer(published))).empty, true);
  for (const parts of [[], ['files', 'preview'], ['relations', 'r1'], ['private', 'provenance']]) {
    await assertFails(read(agent, ...parts));
  }
  await assertFails(updateDoc(doc(agent, path), publication));
  await assertFails(updateDoc(doc(handler, path), { ...publication, title: 'Editado durante publicación' }));
  await assertSucceeds(updateDoc(doc(handler, path), publication));

  const visible = (await assertSucceeds(getDocsFromServer(published))).docs;
  assert.deepEqual(visible.map(({ id }) => id), ['demo-image']);
  assert.equal(visible[0].data().publishedBy, 'handler');
  for (const field of ['referenceCount', 'references', 'relationCount', 'source', 'provenance', 'operationId', 'bytes']) {
    assert.equal(visible[0].data()[field], undefined);
  }
  assert.deepEqual((await assertSucceeds(read(agent, 'files', 'preview'))).data().bytes.toUint8Array(), new Uint8Array(image));
  assert.equal((await assertSucceeds(read(agent, 'relations', 'r1'))).data().targetId, 'public');
  await assertSucceeds(read(agent, 'relations', 'operation'));
  await assertFails(read(agent, 'relations', 'r2'));
  await assertFails(read(agent, 'relations', 'r3'));
  await assertFails(getDocsFromServer(collection(agent, path, 'relations')));
  await assertFails(read(agent, 'private', 'provenance'));
  await assertFails(read(outsider, 'files', 'preview'));
  await assertFails(read(guest, 'files', 'preview'));

  await env.withSecurityRulesDisabled((context) =>
    updateDoc(doc(context.firestore(), cell, 'dossiers', 'public'), { status: 'archived' }));
  await assertFails(read(agent, 'relations', 'r1'));
  await assertSucceeds(updateDoc(doc(handler, path), { status: 'archived', updatedAt: serverTimestamp() }));
  await assertFails(read(agent, 'files', 'preview'));
  await assertFails(read(agent, 'relations', 'operation'));
});

test('PDF uses the same server-validated release and protected byte path', async () => {
  const handler = env.authenticatedContext('handler').firestore();
  const agent = env.authenticatedContext('agent').firestore();
  const path = `${cell}/handouts/demo-pdf`;
  const pdf = await demoPdf();
  const recordRef = doc(handler, path);
  const fileRef = doc(agent, path, 'files', 'preview');
  const metadata = {
    title: 'PDF ficticio', category: 'Prueba', summary: '', narrativeDate: '', tags: '',
    classification: 'RESTRICTED', alt: 'Dos páginas ficticias', downloadAllowed: false,
    mime: 'application/pdf', byteLength: pdf.length, status: 'draft',
    createdAt: serverTimestamp(), createdBy: 'handler', publishedAt: null, publishedBy: '',
    updatedAt: serverTimestamp(),
  };
  await assertFails(setDoc(recordRef, { ...metadata, mime: 'application/zip' }));
  await assertFails(setDoc(recordRef, { ...metadata, byteLength: 102401 }));
  await assertSucceeds(setDoc(recordRef, metadata));
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, cell, 'operations', 'pdf-operation'), record()),
      setDoc(doc(db, path, 'files', 'preview'), { bytes: Bytes.fromUint8Array(pdf) }),
      setDoc(doc(db, path, 'relations', 'operation'), { kind: 'operations', targetId: 'pdf-operation' }),
    ]);
  });
  await assertFails(getDocFromServer(fileRef));
  await assertSucceeds(updateDoc(recordRef, {
    status: 'published', publishedAt: serverTimestamp(), publishedBy: 'handler', updatedAt: serverTimestamp(),
  }));
  assert.deepEqual((await assertSucceeds(getDocFromServer(fileRef))).data().bytes.toUint8Array(), pdf);
  await assertSucceeds(updateDoc(recordRef, { status: 'archived', updatedAt: serverTimestamp() }));
  await assertFails(getDocFromServer(fileRef));
});

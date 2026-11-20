import { storageLimit } from '../src/handouts/limits.ts';
import { createKey, decryptFile, encryptFile, mediaContext } from '../src/handouts/envelope.ts';
import { inspectHandoutFile } from '../src/handouts/upload.ts';
import { clampPage, clampZoom, handoutDownloadName, fileMatches, playerCanSeeTarget } from '../src/handouts/model.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accessState, emptyRecord, filterDossiers, safePhoto } from '../src/domain.ts';

test('protected portal waits for authorization and denies users without membership', () => {
  assert.equal(accessState(false, 'uid', null), 'loading');
  assert.equal(accessState(true, null, null), 'login');
  assert.equal(accessState(true, 'uid', null), 'denied');
  assert.equal(accessState(true, 'uid', { role: 'agent', alias: 'Agent' }), 'allowed');
});

test('dossier search combines accent-insensitive matching with an exact tag', () => {
  const dossiers = [
    { ...emptyRecord, id: '1', title: 'Grabación de recepción', tags: 'Campo, Archivo', publishedAt: null, publishedBy: '', version: '' },
    { ...emptyRecord, id: '2', title: 'Recepción duplicada', tags: 'Archivo', publishedAt: null, publishedBy: '', version: '' },
  ];
  assert.deepEqual(filterDossiers(dossiers, 'RECEPCION grabacion', 'Campo').map(({ id }) => id), ['1']);
  assert.deepEqual(filterDossiers(dossiers, 'recepcion', 'Ausente'), []);
});

test('portraits accept only supported inline raster types', () => {
  assert.equal(safePhoto('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
  for (const prohibited of ['https://example.test/photo', 'data:image/svg+xml;base64,AAAA', 'javascript:alert(1)']) {
    assert.equal(safePhoto(prohibited), '');
  }
});

test('image viewer bounds zoom and only accepts supported raster signatures', () => {
  assert.equal(clampZoom(40), 50);
  assert.equal(clampZoom(260), 250);
  assert.equal(clampZoom(125), 125);
  assert.equal(fileMatches(Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10), 'image/png'), true);
  assert.equal(fileMatches(Uint8Array.of(255, 216, 255), 'image/jpeg'), true);
  assert.equal(fileMatches(new TextEncoder().encode('RIFF0000WEBPVP8 '), 'image/webp'), true);
  assert.equal(fileMatches(new TextEncoder().encode('<svg>'), 'image/png'), false);
  assert.equal(handoutDownloadName('demo-id', 'image/jpeg'), 'handout-demo-id.jpg');
});

test('player projection hides relationships to unpublished or direct archive records', () => {
  assert.equal(playerCanSeeTarget('dossiers', { status: 'published', audience: 'cell' }), true);
  assert.equal(playerCanSeeTarget('dossiers', { status: 'published', audience: 'direct' }), false);
  assert.equal(playerCanSeeTarget('personnel', { status: 'draft', audience: 'cell' }), false);
  assert.equal(playerCanSeeTarget('handouts', { status: 'published' }), true);
  assert.equal(playerCanSeeTarget('handouts', { status: 'archived' }), false);
});

test('PDF viewer clamps page numbers and verifies the media signature', () => {
  assert.equal(clampPage(0, 2), 1);
  assert.equal(clampPage(1, 2), 1);
  assert.equal(clampPage(3, 2), 2);
  assert.equal(fileMatches(new TextEncoder().encode('%PDF-1.7'), 'application/pdf'), true);
  assert.equal(fileMatches(new TextEncoder().encode('<html>'), 'application/pdf'), false);
  assert.equal(handoutDownloadName('demo-pdf', 'application/pdf'), 'handout-demo-pdf.pdf');
});

test('file selection validates size, bytes and the declared MIME', async () => {
  const png = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
  const result = await inspectHandoutFile(new File([png], 'local.png', { type: 'image/png' }));
  assert.equal(result.name, 'local.png');
  assert.equal(result.mime, 'image/png');
  assert.deepEqual(result.bytes, png);
  assert.equal((await inspectHandoutFile(new File(['%PDF-1.7'], 'sample.pdf'))).mime, 'application/pdf');
  await assert.rejects(inspectHandoutFile(new File([png], 'wrong.pdf', { type: 'application/pdf' })), /firma/);
  await assert.rejects(inspectHandoutFile(new File(['<svg>'], 'wrong.png', { type: 'image/png' })), /firma/);
  await assert.rejects(inspectHandoutFile(new File([new Uint8Array(102401)], 'large.pdf')), /100 KiB/);
  await assert.rejects(inspectHandoutFile(new File([], 'empty.pdf')), /100 KiB/);
});

test('Storage size configuration stays bounded and accepts multi-MiB files', async () => {
  assert.equal(storageLimit(undefined), 20 * 1024 * 1024);
  assert.equal(storageLimit('32'), 32 * 1024 * 1024);
  assert.equal(storageLimit('999'), storageLimit(undefined));
  const pdf = new File(['%PDF-1.7', new Uint8Array(2 * 1024 * 1024)], 'demo.pdf', { type: 'application/pdf' });
  assert.equal((await inspectHandoutFile(pdf, storageLimit('4'))).mime, 'application/pdf');
  await assert.rejects(inspectHandoutFile(pdf, storageLimit('1')), /1 MiB/);
});

test('encrypted bytes require the key and exact object identity', async () => {
  const data = new TextEncoder().encode('%PDF-1.7 synthetic');
  const context = mediaContext('cell-a', 'record', 'version', 'application/pdf');
  const key = createKey();
  const encrypted = await encryptFile(data, key, context);
  const decrypted = await decryptFile(encrypted.buffer, key, context);
  assert.deepEqual(new Uint8Array(decrypted), data);
  await assert.rejects(decryptFile(encrypted.buffer, createKey(), context));
  await assert.rejects(decryptFile(encrypted.buffer, key, mediaContext('other', 'record', 'version', 'application/pdf')));
});

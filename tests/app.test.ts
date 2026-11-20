import { clampZoom, imageDownloadName, imageMatches, playerCanSeeTarget } from '../src/handouts/model.ts';
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
  assert.equal(imageMatches(Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10), 'image/png'), true);
  assert.equal(imageMatches(Uint8Array.of(255, 216, 255), 'image/jpeg'), true);
  assert.equal(imageMatches(new TextEncoder().encode('RIFF0000WEBPVP8 '), 'image/webp'), true);
  assert.equal(imageMatches(new TextEncoder().encode('<svg>'), 'image/png'), false);
  assert.equal(imageDownloadName('demo-id', 'image/jpeg'), 'handout-demo-id.jpg');
});

test('player projection hides relationships to unpublished or direct archive records', () => {
  assert.equal(playerCanSeeTarget('dossiers', { status: 'published', audience: 'cell' }), true);
  assert.equal(playerCanSeeTarget('dossiers', { status: 'published', audience: 'direct' }), false);
  assert.equal(playerCanSeeTarget('personnel', { status: 'draft', audience: 'cell' }), false);
  assert.equal(playerCanSeeTarget('handouts', { status: 'published' }), true);
  assert.equal(playerCanSeeTarget('handouts', { status: 'archived' }), false);
});

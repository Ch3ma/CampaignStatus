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

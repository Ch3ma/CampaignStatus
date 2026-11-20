import { createHash } from 'node:crypto';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { demoImage } from './demo-image.mjs';
import { demoPdf } from './demo-pdf.mjs';
import { Bytes, doc, runTransaction, serverTimestamp } from 'firebase/firestore';

const projectId = 'demo-black-archive';
const firestore = { host: '127.0.0.1', port: 8080 };
const authEndpoint = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:';

async function ensureAccount(email, password) {
  const credentials = JSON.stringify({ email, password, returnSecureToken: true });
  async function call(method) {
    const response = await fetch(`${authEndpoint}${method}?key=demo-key`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: credentials,
    });
    return response.json();
  }
  let account = await call('signUp');
  if (account.error?.message === 'EMAIL_EXISTS') account = await call('signInWithPassword');
  if (!account.localId) throw new Error(`No se pudo preparar la cuenta de demostración ${email}`);
  return account.localId;
}

const published = (uid, data) => ({
  title: '', category: '', summary: '', body: '', tags: '', connections: '', photo: '', stage: '',
  status: 'published', audience: 'cell', recipientUid: '',
  publishedAt: serverTimestamp(), publishedBy: uid, updatedAt: serverTimestamp(), ...data,
});

const handler = await ensureAccount('handler@example.test', 'archive-demo-handler');
const agent = await ensureAccount('agent@example.test', 'archive-demo-agent');
const env = await initializeTestEnvironment({ projectId, firestore });

try {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const cell = 'cells/cell-a';
    const preview = demoImage();
    const handout = `${cell}/handouts/demo-telemetry`;
    const pdf = await demoPdf();
    const pdfHandout = `${cell}/handouts/demo-signal-pdf`;
    const extra = (process.env.BLACK_ARCHIVE_RESERVED_SHA256 ?? '').split(',').map((item) => item.trim()).filter(Boolean);
    if (extra.some((hash) => !/^[a-f0-9]{64}$/.test(hash))) throw new Error('Invalid reserved source hash.');
    const testHash = createHash('sha256').update('%PDF-1.7 synthetic reserved source').digest('hex');
    const packet = [
      [cell, { name: 'Cell A' }],
      [`${cell}/members/${handler}`, { role: 'handler', alias: 'Asmodan' }],
      [`${cell}/members/${agent}`, { role: 'agent', alias: 'Agente de prueba' }],
      [handout, {
        title: 'Captura de telemetría', category: 'Imagen de demostración',
        summary: 'Registro ficticio generado para probar el visor y el flujo de publicación.',
        narrativeDate: 'Turno nocturno', tags: 'Transmisión, Campo', classification: 'RESTRICTED',
        alt: 'Una señal verde oscila sobre una cuadrícula con anillos de referencia.',
        downloadAllowed: false, mime: 'image/png', byteLength: preview.length,
        status: 'draft', createdBy: handler, createdAt: serverTimestamp(),
        publishedBy: '', publishedAt: null, updatedAt: serverTimestamp(),
      }],
      [`${handout}/files/preview`, { bytes: Bytes.fromUint8Array(preview) }],
      [`${handout}/relations/operation`, { kind: 'operations', targetId: 'demo-operation' }],
      [`${handout}/relations/r1`, { kind: 'dossiers', targetId: 'demo-report' }],
      [`${handout}/private/provenance`, {
        document: 'Cuaderno de prueba inventado', page: '3', section: 'Ensayo de campo',
        adaptationNotes: 'Telemetría simulada.', supportingPages: '3–4',
        references: [{ kind: 'personnel', targetId: 'demo-contact' }],
      }],
      [pdfHandout, {
        title: 'Informe en dos páginas', category: 'PDF de demostración',
        summary: 'Informe ficticio sobre la recepción y verificación de una señal.',
        narrativeDate: 'Segundo turno', tags: 'Transmisión, Informe', classification: 'RESTRICTED',
        alt: 'Dos páginas de texto describen una señal de prueba ficticia y su verificación.',
        downloadAllowed: false, mime: 'application/pdf', byteLength: pdf.length,
        status: 'draft', createdBy: handler, createdAt: serverTimestamp(),
        publishedBy: '', publishedAt: null, updatedAt: serverTimestamp(),
      }],
      [`${pdfHandout}/files/preview`, { bytes: Bytes.fromUint8Array(pdf) }],
      [`${pdfHandout}/relations/operation`, { kind: 'operations', targetId: 'demo-operation' }],
      [`${pdfHandout}/relations/r1`, { kind: 'clues', targetId: 'demo-signal' }],
      [`${pdfHandout}/private/provenance`, {
        document: 'Guía de señales ficticia', page: '8', section: 'Lectura de control',
        adaptationNotes: 'Informe generado por la semilla.', supportingPages: '8–9',
        references: [{ kind: 'dossiers', targetId: 'demo-draft' }],
      }],
      [`${cell}/operations/demo-operation`, published(handler, {
        title: 'Operación Umbral', stage: 'En curso',
        summary: 'Una estación de monitoreo transmitió fuera del horario previsto. Revisa los registros recuperados por la célula.',
        body: 'El material de esta operación es ficticio. El equipo recibió una copia del registro de recepción y un croquis de referencia.',
      })],
      [`${cell}/dossiers/demo-report`, published(handler, {
        title: 'Registro de recepción', category: 'Informe de campo',
        summary: 'Transcripción de la primera alerta recibida desde la estación de monitoreo.',
        body: 'Se registró una señal intermitente al cierre del turno. El reporte conserva únicamente la hora de recepción y la referencia de la estación.',
        tags: 'Transmisión, Campo',
      })],
      [`${cell}/dossiers/demo-map`, published(handler, {
        title: 'Croquis de la estación', category: 'Documento técnico',
        summary: 'Descripción de los accesos y áreas señaladas en el croquis.',
        body: 'El acceso principal desemboca en un vestíbulo con dos puertas señalizadas. Una conduce al cuarto de monitoreo y la otra a un patio de servicio.',
        tags: 'Ubicación, Campo',
      })],
      [`${cell}/dossiers/demo-draft`, published(handler, {
        title: 'Informe en preparación', category: 'Borrador de demostración',
        summary: 'Registro ficticio para verificar el flujo de publicación.',
        status: 'draft', publishedAt: null, publishedBy: '',
      })],
      [`${cell}/personnel/demo-contact`, published(handler, {
        title: 'Elena Vidal', category: 'Contacto de campo',
        summary: 'Operadora de turno en la estación de monitoreo.',
        connections: 'Registró la alerta descrita en el expediente Registro de recepción.',
        body: 'Punto de contacto de la célula para verificar el reporte ficticio.',
      })],
      [`${cell}/clues/demo-signal`, published(handler, {
        title: 'Marca de recepción', category: 'Evidencia documental',
        summary: 'Anotación obtenida del registro de turno.', tags: 'Transmisión',
      })],
      [`${cell}/messages/demo-brief`, published(handler, {
        title: 'Circular de apertura', category: 'Mensaje de célula',
        summary: 'El registro de recepción está disponible para consulta.',
        body: 'Cell A, revisen el registro de recepción y el croquis de la estación.',
      })],
      [`${cell}/messages/demo-direct`, published(handler, {
        title: 'Confirmación de acceso', category: 'Mensaje directo',
        audience: 'direct', recipientUid: agent, summary: 'Tu cuenta de demostración está activa.',
      })],
    ];
    await runTransaction(db, async (transaction) => {
      const refs = packet.map(([path]) => doc(db, path));
      const policy = doc(db, cell, 'handoutPolicy', 'sources');
      const [existing, ...snapshots] = await Promise.all([policy, ...refs].map((ref) => transaction.get(ref)));
      const previous = existing.data()?.blockedHashes ?? [];
      const blockedHashes = [...new Set([...previous, testHash, ...extra])];
      if (!existing.exists() || blockedHashes.length !== previous.length) transaction.set(policy, { blockedHashes });
      for (const [index, snapshot] of snapshots.entries()) {
        if (!snapshot.exists()) transaction.set(refs[index], packet[index][1]);
      }
    });
  });
  console.log('Demostración local preparada para Cell A.');
} finally {
  await env.cleanup();
}

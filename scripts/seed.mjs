import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

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
    const packet = [
      [cell, { name: 'Cell A' }],
      [`${cell}/members/${handler}`, { role: 'handler', alias: 'Asmodan' }],
      [`${cell}/members/${agent}`, { role: 'agent', alias: 'Agente de prueba' }],
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
      const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
      for (const [index, snapshot] of snapshots.entries()) {
        if (!snapshot.exists()) transaction.set(refs[index], packet[index][1]);
      }
    });
  });
  console.log('Demostración local preparada para Cell A.');
} finally {
  await env.cleanup();
}

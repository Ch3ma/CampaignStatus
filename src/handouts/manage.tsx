import { useEffect, useRef, useState } from 'react';
import { statusLabels } from '../domain';
import { isDemo, RecordChangedError, storage } from '../firebase';
import { useRecords } from '../archive';
import { HandoutEditor, type ReferenceOption } from './editor';
import { inspectHandoutFile, type CheckedHandout } from './upload';
import { uploadLimit } from './storage';
import { emptyRelations, type Handout, type HandoutFields, type RelationFields, type CloudVersion } from './model';
import {
  completeUpload, createHandout, discardUpload, getProvenance, getReadyVersions,
  getRelationsForEdit, restoreVersion, stageReplacement, updateHandout,
} from './repository';
import { HandoutView, RelationList, useHandouts } from './view';

function PrivateProvenance({ id }: { id: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getProvenance>> | 'error'>();
  useEffect(() => {
    let active = true;
    void getProvenance(id).then((value) => { if (active) setData(value); })
      .catch(() => { if (active) setData('error'); });
    return () => { active = false; };
  }, [id]);
  if (data === undefined) return <p role="status">Cargando procedencia…</p>;
  if (data === 'error') return <p role="alert">No se pudo consultar la ficha privada.</p>;
  if (!data) return null;
  return <section className="panel handout-panel" aria-label="Procedencia y referencias privadas">
    <h2>Procedencia reservada al Handler</h2>
    <dl>
      <dt>Documento</dt><dd>{data.document}</dd>
      <dt>Página y sección</dt><dd>{data.page} · {data.section}</dd>
      <dt>Páginas de apoyo</dt><dd>{data.supportingPages}</dd>
      <dt>Notas de adaptación</dt><dd>{data.adaptationNotes}</dd>
    </dl>
    {data.references.length > 0 && <><h3>Referencias privadas</h3><RelationList records={data.references} /></>}
  </section>;
}

type Transfer = { busy: boolean; percent: number; error: string };
type FileActions = {
  upload: (handout: Handout, file: File) => void;
  discard: (handout: Handout) => void;
  restore: (handout: Handout, version: CloudVersion) => void;
};

function FileControls({ handout, busy, actions }: { handout: Handout; busy: boolean; actions: FileActions }) {
  const [versions, setVersions] = useState<Awaited<ReturnType<typeof getReadyVersions>> | 'error'>();
  const cloud = handout.cloud;
  useEffect(() => {
    if (!cloud) return;
    let active = true;
    void getReadyVersions(handout.id).then((entries) => { if (active) setVersions(entries); })
      .catch(() => { if (active) setVersions('error'); });
    return () => { active = false; };
  }, [handout.id, cloud]);
  return <section className="panel handout-panel" aria-label="Archivo y versiones">
    <h2>Archivo y versiones</h2>
    {!cloud?.cleanup && <label>{cloud?.pending ? 'Reintentar con el mismo archivo' : 'Seleccionar archivo de reemplazo'}
      <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" disabled={busy} onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) actions.upload(handout, file);
        event.target.value = '';
      }} />
    </label>}
    {(cloud?.pending || cloud?.cleanup) && <button type="button" disabled={busy} onClick={() => actions.discard(handout)}>
      {cloud.cleanup ? 'Reintentar limpieza' : 'Descartar carga pendiente'}
    </button>}
    {versions === 'error' ? <p role="alert">No se pudo consultar el historial.</p>
      : versions?.filter((version) => version.id !== cloud?.active).map((version) => <button type="button" key={version.id}
        disabled={busy || Boolean(cloud?.pending || cloud?.cleanup)} onClick={() => actions.restore(handout, version)}>
        Restaurar {new Date(version.createdAt).toLocaleString('es-MX')} · {version.mime} · {version.id.slice(0, 6)}
      </button>)}
  </section>;
}

function ManageItem({ handout, uid, options, transfer, actions }: {
  handout: Handout; uid: string; options: ReferenceOption[]; transfer: Transfer; actions: FileActions;
}) {
  const [mode, setMode] = useState<'handler' | 'agent'>('handler');
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState('');
  const canEditRelations = isDemo || Boolean(handout.cloud);
  const [relations, setRelations] = useState<RelationFields | 'error'>();
  useEffect(() => {
    if (!canEditRelations) return;
    let active = true;
    void getRelationsForEdit(handout.id).then((data) => { if (active) setRelations(data); })
      .catch(() => { if (active) setRelations('error'); });
    return () => { active = false; };
  }, [handout.id, canEditRelations]);

  async function update(fields: Parameters<typeof updateHandout>[1], edges?: RelationFields) {
    setBusy(true);
    setError('');
    try { await updateHandout(handout, fields, uid, edges); }
    catch (failure) {
      setError(failure instanceof RecordChangedError
        ? 'El handout cambió en otra sesión. Reabre la ficha para continuar.'
        : 'No se pudo guardar. Verifica la ficha, el archivo y la operación asociada.');
    } finally { setBusy(false); }
  }

  return <div className="handout-management">
    <section className="panel handout-panel" aria-labelledby="handout-workflow">
      <h2 id="handout-workflow">Estado y publicación</h2>
      <p className="hint">{statusLabels[handout.status]} · {handout.id}</p>
      <div className="image-tools" role="group" aria-label="Modo de vista previa">
        <button type="button" aria-pressed={mode === 'handler'} onClick={() => setMode('handler')}>Vista Handler</button>
        <button type="button" aria-pressed={mode === 'agent'} onClick={() => setMode('agent')}>Vista previa como agente</button>
      </div>
      {handout.status !== 'published' && <label className="checkbox">
        <input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} />
        Confirmo que esta copia puede publicarse para Cell A.
      </label>}
      <div className="image-tools">
        {handout.status !== 'published' && <button type="button" className="primary" disabled={!approved || busy || transfer.busy || Boolean(handout.cloud?.pending || handout.cloud?.cleanup)}
          onClick={() => void update('published')}>Publicar handout</button>}
        {handout.status !== 'archived' && <button type="button" disabled={busy || transfer.busy}
          onClick={() => void update('archived')}>Archivar handout</button>}
        {handout.status === 'archived' && <button type="button" disabled={busy || transfer.busy}
          onClick={() => void update('draft')}>Reabrir borrador</button>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
    {mode === 'agent' && <p className="hint">Simulación de los datos visibles después de publicar.</p>}
    <HandoutView key={mode} handout={handout} player={mode === 'agent'} />
    {mode === 'handler' && <>
      {storage && <FileControls handout={handout} busy={busy || transfer.busy} actions={actions} />}
      <PrivateProvenance id={handout.id} />
      {relations === 'error' ? <p role="alert">No se pudieron consultar las referencias para editar.</p>
        : canEditRelations && !relations ? <p role="status">Cargando referencias…</p>
          : <HandoutEditor handout={handout} busy={busy || transfer.busy} options={options} relations={relations}
            save={(values, edges) => void update(values, edges)} />}
    </>}
  </div>;
}

function useReferenceOptions(uid: string, handouts: Handout[]) {
  const session = { uid, role: 'handler' } as const;
  const operations = useRecords('operations', session, 'management');
  const dossiers = useRecords('dossiers', session, 'management');
  const personnel = useRecords('personnel', session, 'management');
  const clues = useRecords('clues', session, 'management');
  const groups = [
    ['operations', operations.records], ['dossiers', dossiers.records], ['personnel', personnel.records],
    ['clues', clues.records], ['handouts', handouts],
  ] as const;
  return groups.flatMap(([kind, records]) => records?.map(({ id, title, status }) => ({ kind, targetId: id, title, status })) ?? []);
}

export function ManageHandouts({ uid }: { uid: string }) {
  const { records, error } = useHandouts(true);
  const [selected, setSelected] = useState('');
  const [creating, setCreating] = useState(false);
  const [transfer, setTransfer] = useState<Transfer>({ busy: false, percent: 0, error: '' });
  const controller = useRef<AbortController | null>(null);
  const options = useReferenceOptions(uid, records ?? []);
  const handout = records?.find((item) => item.id === selected);
  useEffect(() => () => controller.current?.abort(), []);

  async function run(action: (signal: AbortSignal) => Promise<void>) {
    if (controller.current) return;
    const task = new AbortController();
    controller.current = task;
    setTransfer({ busy: true, percent: 0, error: '' });
    try { await action(task.signal); }
    catch (error) {
      const detail = error instanceof Error && !('code' in error) && error.message ? error.message
        : 'No se pudo completar la operación. Una carga pendiente puede reintentarse o descartarse.';
      setTransfer((state) => ({ ...state, error: task.signal.aborted ? 'Carga cancelada. Puedes reintentar con el mismo archivo.' : detail }));
    } finally {
      controller.current = null;
      setTransfer((state) => ({ ...state, busy: false }));
    }
  }

  const track = (percent: number) => setTransfer((state) => ({ ...state, percent }));
  const actions: FileActions = {
    upload: (current, file) => void run(async (signal) => {
      const selected = await inspectHandoutFile(file, uploadLimit);
      signal.throwIfAborted();
      const revision = current.cloud?.pending || await stageReplacement(current, selected);
      await completeUpload(current.id, revision, selected, signal, track);
    }),
    discard: (current) => void run(() => discardUpload(current)),
    restore: (current, version) => void run(() => restoreVersion(current, version)),
  };
  function save(fields: HandoutFields, relations?: RelationFields, file?: CheckedHandout) {
    if (!relations || !file) return;
    void run(async (signal) => {
      const created = await createHandout(fields, relations, file, uid);
      setSelected(created.id);
      setCreating(false);
      await completeUpload(created.id, created.revision, file, signal, track);
    });
  }

  return <div className="manage-grid">
    <section className="panel">
      <div className="section-heading"><h2>Handouts</h2></div>
      {storage && <button type="button" className="new-record" disabled={transfer.busy}
        onClick={() => { setSelected(''); setCreating(true); }}>Nuevo handout</button>}
      {error ? <p className="notice error" role="alert">No se pudo consultar el archivo.</p>
        : !records ? <p className="notice" role="status">Cargando handouts…</p>
          : records.length === 0 ? <p className="notice" role="status">Todavía no hay handouts.</p>
            : records.map((item) => <button type="button" key={item.id} className="manage-row" aria-pressed={selected === item.id}
              disabled={transfer.busy} onClick={() => { setCreating(false); setSelected(item.id); }}>
              <strong>{item.title}</strong><span>{statusLabels[item.status]}</span></button>)}
    </section>
    {creating && storage && <section>
      <HandoutEditor busy={transfer.busy} options={options} relations={emptyRelations}
        save={(fields, edges, file) => void save(fields, edges, file)} />
    </section>}
    {(transfer.busy || transfer.error) && <div className="panel handout-panel">
      {transfer.error && <p className="error" role="alert">{transfer.error}</p>}
      {transfer.busy && <>
        <progress aria-label="Progreso de almacenamiento" value={transfer.percent} max={100} />
        <button type="button" onClick={() => controller.current?.abort()}>Cancelar carga</button>
      </>}
    </div>}
    {handout && <ManageItem key={`${handout.id}/${handout.version}`} handout={handout} uid={uid} options={options} transfer={transfer} actions={actions} />}
  </div>;
}

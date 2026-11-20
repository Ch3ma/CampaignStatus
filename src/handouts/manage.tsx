import { useEffect, useState } from 'react';
import { statusLabels } from '../domain';
import { isDemo, RecordChangedError } from '../firebase';
import { useRecords } from '../archive';
import { HandoutEditor, type ReferenceOption } from './editor';
import type { CheckedHandout } from './upload';
import { emptyRelations, type Handout, type HandoutFields, type RelationFields } from './model';
import { createHandout, getProvenance, getRelationsForEdit, updateHandout } from './repository';
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

function ManageItem({ handout, uid, options }: { handout: Handout; uid: string; options: ReferenceOption[] }) {
  const [mode, setMode] = useState<'handler' | 'agent'>('handler');
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState('');
  const [relations, setRelations] = useState<RelationFields | 'error'>();
  useEffect(() => {
    if (!isDemo) return;
    let active = true;
    void getRelationsForEdit(handout.id).then((data) => { if (active) setRelations(data); })
      .catch(() => { if (active) setRelations('error'); });
    return () => { active = false; };
  }, [handout.id]);

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
        {handout.status !== 'published' && <button type="button" className="primary" disabled={!approved || busy}
          onClick={() => void update('published')}>Publicar handout</button>}
        {handout.status !== 'archived' && <button type="button" disabled={busy}
          onClick={() => void update('archived')}>Archivar handout</button>}
        {handout.status === 'archived' && <button type="button" disabled={busy}
          onClick={() => void update('draft')}>Reabrir borrador</button>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
    {mode === 'agent' && <p className="hint">Simulación de los datos visibles después de publicar.</p>}
    <HandoutView key={mode} handout={handout} player={mode === 'agent'} />
    {mode === 'handler' && <>
      <PrivateProvenance id={handout.id} />
      {relations === 'error' ? <p role="alert">No se pudieron consultar las referencias para editar.</p>
        : isDemo && !relations ? <p role="status">Cargando referencias…</p>
          : <HandoutEditor handout={handout} busy={busy} options={options} relations={relations}
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
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState('');
  const options = useReferenceOptions(uid, records ?? []);
  const handout = records?.find((item) => item.id === selected);

  async function save(fields: HandoutFields, relations?: RelationFields, file?: CheckedHandout) {
    if (!relations || !file) return;
    setBusy(true);
    setCreateError('');
    try {
      setSelected(await createHandout(fields, relations, file, uid));
      setCreating(false);
    } catch {
      setCreateError('No se pudo guardar el borrador. Revisa la ficha, la operación y la conexión al emulador.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="manage-grid">
    <section className="panel">
      <div className="section-heading"><h2>Handouts</h2></div>
      {isDemo && <button type="button" className="new-record" disabled={busy}
        onClick={() => { setSelected(''); setCreateError(''); setCreating(true); }}>Nuevo handout</button>}
      {error ? <p className="notice error" role="alert">No se pudo consultar el archivo.</p>
        : !records ? <p className="notice" role="status">Cargando handouts…</p>
          : records.length === 0 ? <p className="notice" role="status">Todavía no hay handouts.</p>
            : records.map((item) => <button type="button" key={item.id} className="manage-row" aria-pressed={selected === item.id}
              disabled={busy} onClick={() => { setCreating(false); setSelected(item.id); }}>
              <strong>{item.title}</strong><span>{statusLabels[item.status]}</span></button>)}
    </section>
    {creating && isDemo && <section>
      {createError && <p className="error" role="alert">{createError}</p>}
      <HandoutEditor busy={busy} options={options} relations={emptyRelations}
        save={(fields, edges, file) => void save(fields, edges, file)} />
    </section>}
    {handout && <ManageItem key={`${handout.id}/${handout.version}`} handout={handout} uid={uid} options={options} />}
  </div>;
}

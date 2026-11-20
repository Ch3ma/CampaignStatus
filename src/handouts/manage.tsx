import { useEffect, useState, type FormEvent } from 'react';
import { statusLabels } from '../domain';
import { RecordChangedError } from '../firebase';
import type { Handout, HandoutFields } from './model';
import { getProvenance, updateHandout } from './repository';
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

const fields = [
  ['title', 'Título', 120, true], ['category', 'Categoría', 60, false],
  ['narrativeDate', 'Fecha narrativa', 80, false], ['tags', 'Etiquetas', 160, false],
  ['classification', 'Clasificación', 48, true], ['alt', 'Texto alternativo', 240, true],
] as const;

function HandoutEditor({ handout, save, busy }: { handout: Handout; save: (fields: HandoutFields) => void; busy: boolean }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const read = (name: string) => String(data.get(name) ?? '').trim();
    save({
      title: read('title'), category: read('category'), summary: read('summary'), tags: read('tags'),
      classification: read('classification'), alt: read('alt'), narrativeDate: read('narrativeDate'),
      downloadAllowed: data.has('downloadAllowed'),
    });
  }
  return <form className="editor" onSubmit={submit}>
    <fieldset disabled={busy}>
      <legend>Editar ficha</legend>
      <div className="edit-pair">{fields.map(([name, label, size, required]) =>
        <label key={name}>{label}<input name={name} defaultValue={handout[name]} maxLength={size} required={required} /></label>)}</div>
      <label>Resumen<textarea name="summary" rows={3} maxLength={1000} defaultValue={handout.summary} /></label>
      <label className="checkbox"><input name="downloadAllowed" type="checkbox" defaultChecked={handout.downloadAllowed} /> Permitir descargar desde el visor</label>
      {handout.status === 'published' && <p className="hint">Guardar cambios devuelve la ficha a revisión.</p>}
      <button className="primary">Guardar ficha</button>
    </fieldset>
  </form>;
}

function ManageItem({ handout, uid }: { handout: Handout; uid: string }) {
  const [mode, setMode] = useState<'handler' | 'agent'>('handler');
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState('');

  async function update(fields: Parameters<typeof updateHandout>[1]) {
    setBusy(true);
    setError('');
    try { await updateHandout(handout, fields, uid); }
    catch (failure) {
      setError(failure instanceof RecordChangedError
        ? 'El handout cambió en otra sesión. Reabre la ficha para continuar.'
        : 'No se pudo guardar. Verifica la ficha, la imagen y la operación asociada.');
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
      <HandoutEditor handout={handout} busy={busy} save={(values) => void update(values)} />
    </>}
  </div>;
}

export function ManageHandouts({ uid }: { uid: string }) {
  const { records, error } = useHandouts(true);
  const [selected, setSelected] = useState('');
  const handout = records?.find((item) => item.id === selected);
  return <div className="manage-grid">
    <section className="panel">
      <div className="section-heading"><h2>Handouts</h2></div>
      {error ? <p className="notice error" role="alert">No se pudo consultar el archivo.</p>
        : !records ? <p className="notice" role="status">Cargando handouts…</p>
          : records.length === 0 ? <p className="notice" role="status">Todavía no hay handouts.</p>
            : records.map((item) => <button type="button" key={item.id} className="manage-row" aria-pressed={selected === item.id}
              onClick={() => setSelected(item.id)}><strong>{item.title}</strong><span>{statusLabels[item.status]}</span></button>)}
    </section>
    {handout && <ManageItem key={`${handout.id}/${handout.version}`} handout={handout} uid={uid} />}
  </div>;
}

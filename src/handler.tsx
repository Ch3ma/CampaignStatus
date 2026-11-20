import { ManageHandouts } from './handouts/manage';
import { useState, type FormEvent } from 'react';
import { Notice, PageHeading, useRecords, type SessionIdentity } from './archive';
import {
  collectionLabels, collections, emptyRecord, safePhoto, statusLabels, statuses,
  type ArchiveRecord, type Collection, type RecordFields,
} from './domain';
import { RecordChangedError, saveRecord } from './firebase';

function Editor({ section, record, session, saved }: {
  section: Collection; record?: ArchiveRecord; session: SessionIdentity; saved: () => void;
}) {
  const [original] = useState(record);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [audience, setAudience] = useState(original?.audience ?? 'cell');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? '').trim();
    setBusy(true);
    setFeedback('');
    try {
      let photo = data.has('removePhoto') ? '' : original?.photo ?? '';
      const file = data.get('photo');
      if (file instanceof File && file.size > 0) {
        if (file.size > 134000) {
          setFeedback('Elige una foto de 134 kB o menos.');
          return;
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        const imageType = file.type;
        photo = safePhoto(`data:${imageType};base64,${btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))}`);
        if (!photo) {
          setFeedback('Elige una foto JPEG, PNG o WebP.');
          return;
        }
      }
      const status = statuses.find((item) => item === value('status')) ?? 'draft';
      const fields: RecordFields = {
        title: value('title'), category: value('category'), summary: value('summary'),
        body: value('body'), tags: value('tags'), stage: value('stage'), connections: value('connections'), photo,
        status, audience, recipientUid: audience === 'direct' ? value('recipientUid') : '',
      };
      if (!fields.title || (audience === 'direct' && !fields.recipientUid)) {
        setFeedback('Completa el título y, para un mensaje directo, el UID del destinatario.');
        return;
      }
      await saveRecord(section, fields, session.uid, original);
      saved();
    } catch (error) {
      setFeedback(error instanceof RecordChangedError
        ? 'Este registro cambió mientras lo editabas. Vuelve a seleccionarlo para cargar la versión actual.'
        : 'No se pudo guardar el registro. Revisa tu acceso y vuelve a intentarlo.');
    } finally {
      setBusy(false);
    }
  }

  const defaults = original ?? emptyRecord;
  return <form className="editor" onSubmit={(event) => void submit(event)}>
    <fieldset disabled={busy}>
      <legend>{record ? 'Editar registro' : 'Nuevo registro'}</legend>
      <div className="edit-pair">
        <label>Título<input name="title" defaultValue={defaults.title} required maxLength={120} /></label>
        <label>Categoría<input name="category" defaultValue={defaults.category} maxLength={60} /></label>
      </div>
      <label>Resumen<textarea name="summary" defaultValue={defaults.summary} maxLength={500} rows={2} /></label>
      <label>Contenido<textarea name="body" defaultValue={defaults.body} maxLength={24000} rows={7} /></label>
      <label>Etiquetas separadas por comas<input name="tags" defaultValue={defaults.tags} maxLength={160} /></label>
      {section === 'operations' && <label>Estado operativo<input name="stage" defaultValue={defaults.stage} maxLength={60} /></label>}
      {section === 'personnel' && <>
        <label>Conexiones reveladas<textarea name="connections" defaultValue={defaults.connections} maxLength={3000} rows={3} /></label>
        <label>Retrato autorizado (JPEG, PNG o WebP, hasta 134 kB)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" /></label>
        {defaults.photo && <label className="checkbox"><input name="removePhoto" type="checkbox" /> Quitar retrato actual</label>}
      </>}
      {section === 'messages' && <div className="edit-pair">
        <label>Audiencia<select value={audience} onChange={(event) => setAudience(event.target.value === 'direct' ? 'direct' : 'cell')}>
          <option value="cell">Toda la célula</option><option value="direct">Agente específico</option>
        </select></label>
        {audience === 'direct' && <label>UID del destinatario<input name="recipientUid" defaultValue={defaults.recipientUid} required maxLength={128} /></label>}
      </div>}
      <label>Visibilidad<select name="status" defaultValue={defaults.status}>
        {statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
      </select></label>
      <p className="hint">Al publicar, se libera el registro completo para la audiencia elegida.</p>
      {feedback && <Notice error>{feedback}</Notice>}
      <button className="primary">{busy ? 'Guardando…' : 'Guardar registro'}</button>
    </fieldset>
  </form>;
}

function Section({ section, session }: { section: Collection; session: SessionIdentity }) {
  const state = useRecords(section, session, 'management');
  const [selection, setSelection] = useState('');
  const [feedback, setFeedback] = useState('');
  const [editorKey, setEditorKey] = useState(0);
  const record = state.records?.find(({ id }) => id === selection);
  function saved() {
    setFeedback('Registro guardado.');
    setSelection('');
    setEditorKey((previous) => previous + 1);
  }
  if (state.error) return <Notice error>No se pudo consultar esta sección.</Notice>;
  return <>
    {feedback && <Notice>{feedback}</Notice>}
    <div className="manage-grid">
      <section className="panel">
        <div className="section-heading"><h2>{collectionLabels[section]}</h2></div>
        <button className="new-record" onClick={() => { setSelection(''); setFeedback(''); setEditorKey((previous) => previous + 1); }}>Crear registro</button>
        {!state.records && <Notice>Cargando registros…</Notice>}
        {state.records?.length === 0 && <Notice>Esta sección está vacía.</Notice>}
        {state.records?.map((item) => <button className="manage-row" key={item.id}
          aria-pressed={selection === item.id}
          onClick={() => { setSelection(item.id); setFeedback(''); setEditorKey((previous) => previous + 1); }}>
          <strong>{item.title}</strong><span>{statusLabels[item.status]}</span></button>)}
      </section>
      {(!selection || record) && <Editor key={`${selection}-${editorKey}`} section={section} record={record} session={session} saved={saved} />}
    </div>
  </>;
}

export function Handler({ session }: { session: SessionIdentity }) {
  const [section, setSection] = useState<Collection | 'handouts'>('dossiers');
  return <>
    <PageHeading eyebrow="Administración de célula" title="Panel del Handler">
      Revisa los registros y controla qué material se publica.
    </PageHeading>
    <div className="manage-tabs" role="group" aria-label="Tipo de registro">
      {collections.map((item) => <button key={item} aria-pressed={section === item} onClick={() => setSection(item)}>
        {collectionLabels[item]}</button>)}
      <button aria-pressed={section === 'handouts'} onClick={() => setSection('handouts')}>Handouts</button>
    </div>
    {section === 'handouts' ? <ManageHandouts uid={session.uid} /> : <Section key={section} section={section} session={session} />}
  </>;
}

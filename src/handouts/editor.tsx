import { useId, useRef, useState, type FormEvent } from 'react';
import { statusLabels, type Status } from '../domain';
import {
  relationLabels, visibleRelationSlots, type Handout, type HandoutFields, type Relation, type RelationFields,
} from './model';
import { inspectHandoutFile, type CheckedHandout } from './upload';
import { HandoutViewer } from './view';

export type ReferenceOption = Relation & { title: string; status: Status };

function referenceKey(link: Relation) {
  return `${link.kind}:${link.targetId}`;
}

function ReferenceList({ label, options, references, setReferences }: {
  label: string; options: ReferenceOption[]; references: Relation[]; setReferences: (value: Relation[]) => void;
}) {
  const inputId = useId();
  const [selected, setSelected] = useState('');
  const available = options.filter((option) => !references.some((edge) => referenceKey(edge) === referenceKey(option)));
  const candidate = available.find((item) => referenceKey(item) === selected);
  return <section className="reference-editor" aria-label={label}>
    <label htmlFor={inputId}>{label}</label>
    <select id={inputId} value={selected} onChange={(event) => setSelected(event.target.value)}>
      <option value="">Elige un registro</option>
      {available.map((item) => <option key={referenceKey(item)} value={referenceKey(item)}>
        {relationLabels[item.kind]} · {item.title} · {statusLabels[item.status]}
      </option>)}
    </select>
    <button type="button" disabled={!candidate || references.length >= visibleRelationSlots.length} onClick={() => {
      if (candidate) setReferences([...references, { kind: candidate.kind, targetId: candidate.targetId }]);
      setSelected('');
    }}>Añadir referencia</button>
    {references.length > 0 && <ul>{references.map((link) => {
      const option = options.find((item) => referenceKey(item) === referenceKey(link));
      const text = option?.title ?? link.targetId;
      return <li key={referenceKey(link)}>
        <span>{relationLabels[link.kind]} · {text}</span>
        <button type="button" aria-label={`Quitar referencia a ${text}`}
          onClick={() => setReferences(references.filter((item) => referenceKey(item) !== referenceKey(link)))}>Quitar</button>
      </li>;
    })}</ul>}
  </section>;
}

const fields = [
  ['title', 'Título', 120, true], ['category', 'Categoría', 60, false],
  ['narrativeDate', 'Fecha narrativa', 80, false], ['tags', 'Etiquetas', 160, false],
  ['classification', 'Clasificación', 48, true], ['alt', 'Texto alternativo', 240, true],
] as const;

type Selection = { file: CheckedHandout; blob: Blob; revision: number };

export function HandoutEditor({ handout, relations, options, save, busy }: {
  handout?: Handout;
  relations?: RelationFields;
  options: ReferenceOption[];
  save: (fields: HandoutFields, relations?: RelationFields, file?: CheckedHandout) => void;
  busy: boolean;
}) {
  const operationInput = useId();
  const [operation, setOperation] = useState(relations?.operationId ?? '');
  const [visible, setVisible] = useState(relations?.visible ?? []);
  const [reserved, setReserved] = useState(relations?.provenance.references ?? []);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState(false);
  const [fileError, setFileError] = useState('');
  const attempt = useRef(0);
  const source = relations?.provenance;

  async function select(file?: File) {
    const revision = ++attempt.current;
    setFileError('');
    setSelection(null);
    setPreview(false);
    setChecking(Boolean(file));
    if (!file) return;
    try {
      const checked = await inspectHandoutFile(file);
      if (attempt.current !== revision) return;
      const blob = new Blob([checked.bytes], { type: checked.mime });
      setSelection({ file: checked, blob, revision });
    } catch (error) {
      if (attempt.current === revision) setFileError(error instanceof Error ? error.message : 'No se pudo leer el archivo.');
    } finally {
      if (attempt.current === revision) setChecking(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const read = (name: string) => String(data.get(name) ?? '').trim();
    const edited: HandoutFields = {
      title: read('title'), category: read('category'), summary: read('summary'), tags: read('tags'),
      classification: read('classification'), alt: read('alt'), narrativeDate: read('narrativeDate'),
      downloadAllowed: data.has('downloadAllowed'),
    };
    if (!handout && !selection) return;
    save(edited, relations ? {
      operationId: operation, visible,
      provenance: {
        document: read('sourceDocument'), page: read('sourcePage'), section: read('sourceSection'),
        adaptationNotes: read('adaptationNotes'), supportingPages: read('supportingPages'), references: reserved,
      },
    } : undefined, selection?.file);
  }

  const operations = options.filter(({ kind }) => kind === 'operations');
  const targets = options.filter(({ kind, targetId }) => kind !== 'handouts' || targetId !== handout?.id);

  return <form className="editor" onSubmit={submit}>
    <fieldset disabled={busy}>
      <legend>{handout ? 'Editar ficha' : 'Nuevo handout'}</legend>
      {!handout && <>
        <label>Archivo multimedia
          <input type="file" accept=".png,.jpg,.jpeg,.webp,.pdf" required
            onChange={(event) => void select(event.target.files?.[0])} />
        </label>
        <p className="hint">PNG, JPEG, WebP o PDF. Hasta 100 KiB por archivo.</p>
        {checking && <p role="status">Comprobando archivo…</p>}
        {fileError && <p className="error" role="alert">{fileError}</p>}
        {selection && <>
          <p className="file-selection">{selection.file.name} · {selection.file.mime} · {selection.file.bytes.length} bytes</p>
          <button type="button" aria-expanded={preview} onClick={() => setPreview(!preview)}>
            {preview ? 'Cerrar vista previa del archivo' : 'Previsualizar archivo seleccionado'}
          </button>
          {preview && <HandoutViewer key={selection.revision} localFile={selection.blob} player handout={{
            id: 'local-preview', mime: selection.file.mime, byteLength: selection.file.bytes.length,
            alt: 'Vista previa del archivo seleccionado', downloadAllowed: false,
          }} />}
        </>}
      </>}
      <div className="edit-pair">{fields.map(([name, label, size, required]) =>
        <label key={name}>{label}<input name={name} defaultValue={handout?.[name] ?? (name === 'classification' ? 'RESTRICTED' : '')}
          maxLength={size} required={required} /></label>)}</div>
      <label>Resumen<textarea name="summary" rows={3} maxLength={1000} defaultValue={handout?.summary} /></label>
      <label className="checkbox"><input name="downloadAllowed" type="checkbox" defaultChecked={handout?.downloadAllowed} /> Permitir descargar desde el visor</label>
      {relations && <>
        <div className="reference-editor">
          <label htmlFor={operationInput}>Operación</label>
          <select id={operationInput} value={operation} onChange={(event) => setOperation(event.target.value)} required>
            <option value="">Elige una operación</option>
            {operations.map((item) => <option key={item.targetId} value={item.targetId}>{item.title} · {statusLabels[item.status]}</option>)}
          </select>
        </div>
        <ReferenceList label="Referencia visible" options={targets.filter(({ kind }) => kind !== 'operations')}
          references={visible} setReferences={setVisible} />
        <details className="private-editor" open={!handout}>
          <summary>Editar procedencia y referencias privadas</summary>
          <label>Documento de origen<input name="sourceDocument" maxLength={180} defaultValue={source?.document} /></label>
          <div className="edit-pair">
            <label>Página de origen<input name="sourcePage" maxLength={60} defaultValue={source?.page} /></label>
            <label>Sección de origen<input name="sourceSection" maxLength={180} defaultValue={source?.section} /></label>
          </div>
          <label>Páginas de apoyo<input name="supportingPages" maxLength={120} defaultValue={source?.supportingPages} /></label>
          <label>Notas de adaptación<textarea name="adaptationNotes" rows={3} maxLength={2400} defaultValue={source?.adaptationNotes} /></label>
          <ReferenceList label="Referencia privada" options={targets} references={reserved} setReferences={setReserved} />
        </details>
      </>}
      {handout?.status === 'published' && <p className="hint">Guardar cambios devuelve la ficha a revisión.</p>}
      <button className="primary" disabled={checking || (!handout && !selection)}>{handout ? 'Guardar ficha' : 'Guardar borrador'}</button>
    </fieldset>
  </form>;
}

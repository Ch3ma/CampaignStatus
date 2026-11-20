import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  collectionLabels, dateLabel, filterDossiers, splitTags,
  type ArchiveRecord, type Collection, type Role,
} from './domain';
import { watchRecords } from './firebase';

export type SessionIdentity = { uid: string; role: Role };
type LoadState = { records: ArchiveRecord[] | null; error: boolean };

export function useRecords(section: Collection, session: SessionIdentity, scope: 'published' | 'management' = 'published') {
  const { uid, role } = session;
  const [state, setState] = useState<LoadState>({ records: null, error: false });
  useEffect(() => watchRecords(section, scope, uid, role,
    (records) => setState({ records, error: false }),
    () => setState({ records: null, error: true })), [section, scope, uid, role]);
  return state;
}

export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <p className={error ? 'notice error' : 'notice'} role={error ? 'alert' : 'status'}>{children}</p>;
}

export function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <header className="page-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>
    {children && <div className="lede">{children}</div>}</header>;
}

function CollectionStatus({ state, empty }: { state: LoadState; empty: string }) {
  if (state.error) return <Notice error>No se pudo consultar el archivo. Verifica tu conexión o recarga la página.</Notice>;
  if (!state.records) return <Notice>Cargando registros…</Notice>;
  return state.records.length === 0 ? <Notice>{empty}</Notice> : null;
}

export function Dashboard({ session, cellName }: { session: SessionIdentity; cellName: string }) {
  const operations = useRecords('operations', session);
  const dossiers = useRecords('dossiers', session);
  const clues = useRecords('clues', session);
  const messages = useRecords('messages', session);
  const operation = operations.records?.[0];
  return <>
    <PageHeading eyebrow="Centro de operaciones" title={cellName}>
      Estado de la operación y últimos registros de tu célula.
    </PageHeading>
    <section className="operation" aria-labelledby="operation-title">
      <div className="scope-art" aria-hidden="true"><div className="target" /></div>
      <div className="operation-content"><p className="eyebrow">Operación actual</p>
        {operation ? <>
          <h2 id="operation-title">{operation.title}</h2><p>{operation.summary}</p>
          {operation.stage && <span className="status"><span className="dot" />{operation.stage}</span>}
          {operation.body && <details><summary>Leer informe operativo</summary><p className="record-text">{operation.body}</p></details>}
        </> : <><h2 id="operation-title">Informe operativo</h2>
          <CollectionStatus state={operations} empty="Todavía no hay una operación publicada." /></>}
      </div>
    </section>
    <div className="counters">
      {([
        ['Expedientes', '/expedientes', dossiers, '▤'],
        ['Evidencias', '/evidencias', clues, '◇'],
        ['Comunicaciones', '/comunicaciones', messages, '▱'],
      ] as const).map(([label, path, state, mark]) => <Link className="counter" key={path} to={path}>
        <span className="counter-icon" aria-hidden="true">{mark}</span><span>{label}</span>
        <strong>{state.error ? 'Error' : state.records?.length ?? '…'}</strong>
      </Link>)}
    </div>
    <div className="dashboard-grid">
      <section className="panel"><div className="section-heading"><h2>Últimas comunicaciones</h2>
        <Link to="/comunicaciones">Ver bandeja</Link></div>
        <CollectionStatus state={messages} empty="Todavía no hay comunicaciones." />
        {messages.records?.slice(0, 3).map((record) => <Link className="feed-row" key={record.id} to={`/comunicaciones/${record.id}`}>
          <span className="feed-mark" aria-hidden="true">▱</span><span><strong>{record.title}</strong>
            <small>{record.summary || record.category}</small></span><time>{dateLabel(record.publishedAt)}</time></Link>)}
      </section>
      <section className="panel"><div className="section-heading"><h2>Expedientes recientes</h2>
        <Link to="/expedientes">Ver índice</Link></div>
        <CollectionStatus state={dossiers} empty="Todavía no hay expedientes publicados." />
        {dossiers.records?.slice(0, 3).map((record) => <Link className="feed-row" key={record.id} to={`/expedientes/${record.id}`}>
          <span className="feed-mark" aria-hidden="true">▤</span><span><strong>{record.title}</strong>
            <small>{record.category}</small></span></Link>)}
      </section>
    </div>
  </>;
}

function RecordDetail({ record, section, base }: { record: ArchiveRecord; section: Collection; base: string }) {
  return <>
    <div className="detail-controls"><Link to={base}>Volver a {collectionLabels[section].toLowerCase()}</Link>
      <button onClick={() => window.print()}>Imprimir</button></div>
    <article className="record-paper">
      <div className="record-top"><p className="eyebrow">{record.category || collectionLabels[section]}</p><span className="stamp">RESTRICTED</span></div>
      <h1>{record.title}</h1><p className="record-date">{dateLabel(record.publishedAt)}</p>
      {record.photo && <img className="portrait" src={record.photo} alt={`Retrato de ${record.title}`} />}
      {record.summary && <p className="record-summary">{record.summary}</p>}
      <Tags tags={record.tags} />
      {record.body && <p className="record-text">{record.body}</p>}
      {record.connections && <section className="connections"><h2>Conexiones reveladas</h2>
        <p className="record-text">{record.connections}</p></section>}
    </article>
  </>;
}

function Tags({ tags }: { tags: string }) {
  return <div className="tags">{splitTags(tags).map((tag) => <span key={tag}>{tag}</span>)}</div>;
}

export function ArchiveList({ section, base, session }: { section: Collection; base: string; session: SessionIdentity }) {
  const state = useRecords(section, session);
  const { recordId } = useParams();
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('');
  if (recordId) {
    const record = state.records?.find(({ id }) => id === recordId);
    if (record) return <RecordDetail record={record} section={section} base={base} />;
    return <><PageHeading eyebrow="Archivo de célula" title={collectionLabels[section]} />
      {state.records ? <Notice>Registro no disponible.</Notice> : <CollectionStatus state={state} empty="" />}
      <Link className="return-link" to={base}>Volver al índice</Link></>;
  }
  const tags = [...new Set(state.records?.flatMap((record) => splitTags(record.tags)))].sort();
  const activeTag = tags.includes(tag) ? tag : '';
  const filtered = state.records ? filterDossiers(state.records, search, activeTag) : [];
  return <>
    <PageHeading eyebrow="Archivo de célula" title={collectionLabels[section]}>
      {(section === 'dossiers' || section === 'clues') && <Link to="/handouts">Consultar archivo multimedia</Link>}
    </PageHeading>
    {section === 'dossiers' && <div className="filters">
      <label>Buscar expedientes<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Título, descripción o etiqueta" /></label>
      <label>Etiqueta<select value={activeTag} onChange={(event) => setTag(event.target.value)}>
        <option value="">Todas</option>{tags.map((item) => <option key={item}>{item}</option>)}</select></label>
    </div>}
    <CollectionStatus state={state} empty="Todavía no hay registros publicados." />
    {Boolean(state.records?.length) && filtered.length === 0 && <Notice>Ningún expediente coincide con los filtros.</Notice>}
    <div className="record-grid">{filtered.map((record) => <Link className="record-card" key={record.id} to={`${base}/${record.id}`}>
      {record.photo && <img src={record.photo} alt="" className="card-portrait" loading="lazy" />}
      <p className="eyebrow">{record.category || collectionLabels[section]}</p><h2>{record.title}</h2>
      {record.summary && <p>{record.summary}</p>}<Tags tags={record.tags} />
      <span className="record-date">{dateLabel(record.publishedAt)}</span></Link>)}</div>
  </>;
}

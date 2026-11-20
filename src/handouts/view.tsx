import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { splitTags } from '../domain';
import { isDemo, storage } from '../firebase';
import { clampZoom, handoutDownloadName, relationLabels, relationRoutes, type Handout, type LinkedRecord } from './model';
import { getHandoutFile, watchHandouts, watchRelations } from './repository';

const PdfPreview = lazy(() => import('./pdf-view'));

export function useHandouts(handling: boolean) {
  const [state, setState] = useState<{ records: Handout[] | null; error: boolean }>({ records: null, error: false });
  useEffect(() => watchHandouts(handling, (records) => setState({ records, error: false }),
    () => setState({ records: null, error: true })), [handling]);
  return state;
}

export function HandoutViewer({ handout, player, localFile }: {
  handout: Pick<Handout, 'id' | 'mime' | 'byteLength' | 'alt' | 'downloadAllowed' | 'cloud'>;
  player: boolean;
  localFile?: Blob;
}) {
  const { id, mime, byteLength, cloud } = handout;
  const available = Boolean(localFile || (cloud?.active ? storage : isDemo));
  const [media, setMedia] = useState<{ file: Blob; url: string } | 'error' | null>(null);
  const [zoom, setZoom] = useState(100);
  useEffect(() => {
    if (!available) return;
    let active = true;
    let objectUrl: string | undefined;
    const source = localFile ? Promise.resolve(localFile) : getHandoutFile({ id, mime, byteLength, cloud });
    void source.then((file) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(file);
      setMedia({ file, url: objectUrl });
    }).catch(() => { if (active) setMedia('error'); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id, mime, byteLength, cloud, localFile, available]);

  if (!available) return <p role="status">El archivo multimedia no está disponible en este entorno.</p>;
  if (media === 'error') return <p role="alert">El archivo no está disponible.</p>;
  if (!media) return <p role="status">Cargando archivo…</p>;
  const pdf = mime === 'application/pdf';
  const allowDownload = !player || handout.downloadAllowed;
  const printClass = pdf && allowDownload ? ' print-handout' : '';
  return <section className={`image-viewer${printClass}`} aria-label="Visor del handout">
    <div className="image-tools" role="group" aria-label="Controles del visor">
      <button type="button" disabled={zoom <= 50} onClick={() => setZoom(clampZoom(zoom - 25))}>Alejar</button>
      <button type="button" disabled={zoom >= 250} onClick={() => setZoom(clampZoom(zoom + 25))}>Acercar</button>
      <button type="button" onClick={() => setZoom(100)}>Ajustar al ancho</button>
      <output aria-live="polite">{zoom}%</output>
      {allowDownload && <a href={media.url} download={handoutDownloadName(id, mime)}>
        {pdf ? 'Descargar PDF' : 'Descargar imagen'}</a>}
    </div>
    {pdf ? <>
      <p className="hint pdf-description">{handout.alt}</p>
      <Suspense fallback={<p role="status">Cargando visor PDF…</p>}>
        <PdfPreview file={media.file} zoom={zoom} allowPrint={allowDownload} />
      </Suspense>
    </> : <div className="image-scroll" tabIndex={0} aria-label="Imagen ampliable">
      <img src={media.url} alt={handout.alt} style={{ width: `${zoom}%` }} onError={() => setMedia('error')} />
    </div>}
  </section>;
}

export function RelationList({ records }: { records: LinkedRecord[] }) {
  return <ul>{records.map(({ kind, targetId, title }) => <li key={`${kind}/${targetId}`}>
    {kind === 'operations' ? <span>{relationLabels[kind]} · {title}</span>
      : <Link to={`${relationRoutes[kind]}/${encodeURIComponent(targetId)}`}>{relationLabels[kind]} · {title}</Link>}
  </li>)}</ul>;
}

export function HandoutView({ handout, player }: { handout: Handout; player: boolean }) {
  const [links, setLinks] = useState<LinkedRecord[]>([]);
  useEffect(() => watchRelations(handout.id, player, setLinks), [handout.id, player]);
  return <>
    <article className="record-paper">
      <div className="record-top"><p className="eyebrow">{handout.category}</p><span className="stamp">{handout.classification}</span></div>
      <h1>{handout.title}</h1>
      {handout.summary && <p className="record-text">{handout.summary}</p>}
      {handout.narrativeDate && <p>Fecha narrativa · {handout.narrativeDate}</p>}
      <div className="tags">{splitTags(handout.tags).map((tag) => <span key={tag}>{tag}</span>)}</div>
      {links.length > 0 && <section aria-label="Referencias reveladas"><h2>Referencias reveladas</h2><RelationList records={links} /></section>}
    </article>
    <HandoutViewer key={handout.cloud?.active ?? 'inline'} handout={handout} player={player} />
  </>;
}

export function HandoutArchive() {
  const { handoutId } = useParams();
  const { records, error } = useHandouts(false);
  const handout = records?.find((item) => item.id === handoutId);
  if (handout) return <><p className="handout-nav"><Link to="/handouts">Volver al archivo multimedia</Link></p>
    <HandoutView key={handout.id} handout={handout} player /></>;
  return <>
    <header className="page-heading"><p className="eyebrow">Archivo de célula</p><h1>Archivo multimedia</h1></header>
    {error ? <p className="notice error" role="alert">No se pudo consultar el archivo.</p>
      : !records ? <p className="notice" role="status">Cargando handouts…</p>
        : handoutId ? <><p className="notice" role="status">Handout no disponible.</p><Link to="/handouts">Volver al índice</Link></>
          : records.length === 0 ? <p className="notice" role="status">Todavía no hay handouts publicados.</p>
            : <div className="record-grid">{records.map((item) => <Link className="record-card" key={item.id} to={`/handouts/${item.id}`}>
              <p className="eyebrow">{item.category}</p><h2>{item.title}</h2><p>{item.summary}</p>
            </Link>)}</div>}
  </>;
}

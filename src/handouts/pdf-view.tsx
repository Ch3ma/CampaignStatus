import { useEffect, useRef, useState } from 'react';
import { AnnotationMode, getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { clampPage } from './model';

GlobalWorkerOptions.workerSrc = workerUrl;

function PdfPage({ document, pageNumber, zoom, allowPrint }: {
  document: PDFDocumentProxy; pageNumber: number; zoom: number; allowPrint: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [result, setResult] = useState<{ text: string } | 'error' | null>(null);
  useEffect(() => {
    let active = true;
    let task: RenderTask | undefined;
    const canvas = canvasRef.current;
    async function render() {
      const page = await document.getPage(pageNumber);
      if (!active || !canvas) return;
      const natural = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 1600 / Math.max(natural.width, natural.height) });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      task = page.render({ canvas, viewport, annotationMode: AnnotationMode.DISABLE });
      const [text] = await Promise.all([
        page.getTextContent().then(({ items }) => items.flatMap((item) => 'str' in item ? [item.str] : []).join(' '))
          .catch(() => ''),
        task.promise,
      ]);
      if (active) setResult({ text });
    }
    void render().catch(() => { if (active) setResult('error'); });
    return () => { active = false; task?.cancel(); };
  }, [document, pageNumber]);

  const ready = result !== null && result !== 'error';
  return <>
    {result === 'error' && <p role="alert">No se pudo dibujar esta página.</p>}
    {result === null && <p role="status">Cargando página…</p>}
    {ready && allowPrint && <div className="image-tools pdf-controls">
      <button type="button" onClick={() => window.print()}>Imprimir página actual</button>
    </div>}
    <div className="image-scroll" tabIndex={0} aria-label="Página ampliable">
      <canvas ref={canvasRef} hidden={!ready} role="img" aria-label={`Página ${pageNumber} del PDF`} style={{ width: `${zoom}%` }} />
    </div>
    {ready && result.text && <details className="pdf-text"><summary>Texto de esta página</summary>
      <p>{result.text}</p>
    </details>}
  </>;
}

export default function PdfPreview({ file, zoom, allowPrint }: { file: Blob; zoom: number; allowPrint: boolean }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | 'error' | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    let task: ReturnType<typeof getDocument> | undefined;
    async function open() {
      const data = new Uint8Array(await file.arrayBuffer());
      if (!active) return;
      task = getDocument({ data, enableXfa: false, useSystemFonts: true, maxImageSize: 16_000_000 });
      const document = await task.promise;
      if (active) setPdf(document);
    }
    void open().catch(() => { if (active) setPdf('error'); });
    return () => { active = false; if (task) void task.destroy().catch(() => {}); };
  }, [file]);

  if (pdf === 'error') return <p role="alert">No se pudo abrir este PDF.</p>;
  if (pdf === null) return <p role="status">Cargando PDF…</p>;
  return <>
    <div className="image-tools pdf-controls" role="group" aria-label="Páginas del PDF">
      <button type="button" disabled={page === 1} onClick={() => setPage((value) => clampPage(value - 1, pdf.numPages))}>Página anterior</button>
      <output aria-live="polite">{page} de {pdf.numPages}</output>
      <button type="button" disabled={page === pdf.numPages} onClick={() => setPage((value) => clampPage(value + 1, pdf.numPages))}>Página siguiente</button>
    </div>
    <PdfPage key={page} document={pdf} pageNumber={page} zoom={zoom} allowPrint={allowPrint} />
  </>;
}

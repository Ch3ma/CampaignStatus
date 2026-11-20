import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright-core';
import { demoImage } from '../scripts/demo-image.mjs';
import { demoPdf } from '../scripts/demo-pdf.mjs';

const origin = 'http://127.0.0.1:5173';
const title = 'Captura de telemetría';
const alt = 'Una señal verde oscila sobre una cuadrícula con anillos de referencia.';
const publicReference = 'Expediente · Registro de recepción';
const privateReference = 'Personal · Elena Vidal';
const privateSource = 'Cuaderno de prueba inventado';

test('agent receives only the published image and the visible reference', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
  try {
    const handler = await browser.newPage();
    const agent = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    await handler.goto(`${origin}/handler`);
    await handler.getByRole('button', { name: 'Entrar como Handler' }).click();
    await handler.getByRole('button', { name: 'Handouts', exact: true }).click();
    await handler.getByRole('button', { name: new RegExp(title) }).click();
    await handler.getByRole('img', { name: alt }).waitFor();
    await handler.getByRole('link', { name: publicReference }).waitFor();
    await handler.getByRole('link', { name: privateReference }).waitFor();
    await handler.getByText(privateSource).waitFor();

    await handler.getByRole('button', { name: 'Vista previa como agente' }).click();
    await handler.getByRole('link', { name: publicReference }).waitFor();
    assert.equal(await handler.getByText(privateSource).count(), 0);
    assert.equal(await handler.getByText(privateReference).count(), 0);
    assert.equal(await handler.getByRole('link', { name: 'Descargar imagen' }).count(), 0);

    await agent.goto(`${origin}/handouts/demo-telemetry`);
    await agent.getByRole('button', { name: 'Entrar como agente' }).click();
    await agent.getByText('Handout no disponible.').waitFor();

    const publish = handler.getByRole('button', { name: 'Publicar handout' });
    assert.equal(await publish.isDisabled(), true);
    await handler.getByRole('checkbox', { name: /Confirmo que esta copia/ }).check();
    await publish.click();

    const image = agent.getByRole('img', { name: alt });
    await image.waitFor();
    await agent.waitForFunction((description) =>
      [...document.images].some((item) => item.alt === description && item.naturalWidth === 640), alt);
    await agent.getByRole('link', { name: publicReference }).waitFor();
    assert.equal(await agent.getByText(privateSource).count(), 0);
    assert.equal(await agent.getByText(privateReference).count(), 0);
    assert.equal(await agent.getByRole('heading', { name: 'Referencias privadas' }).count(), 0);
    assert.equal(await agent.getByRole('link', { name: 'Descargar imagen' }).count(), 0);

    await agent.getByRole('button', { name: 'Acercar' }).click();
    assert.equal(await image.evaluate((item) => item.style.width), '125%');
    assert.equal(await agent.evaluate(() => document.documentElement.scrollWidth), 390);
    await agent.getByRole('button', { name: 'Ajustar al ancho' }).click();
    assert.equal(await image.evaluate((item) => item.style.width), '100%');

    await handler.getByRole('checkbox', { name: 'Permitir descargar desde el visor' }).check();
    await handler.getByRole('button', { name: 'Guardar ficha' }).click();
    await agent.getByText('Handout no disponible.').waitFor();
    await handler.getByRole('checkbox', { name: /Confirmo que esta copia/ }).check();
    await publish.click();
    const [download] = await Promise.all([
      agent.waitForEvent('download'),
      agent.getByRole('link', { name: 'Descargar imagen' }).click(),
    ]);
    assert.equal(download.suggestedFilename(), 'handout-demo-telemetry.png');

    await handler.getByRole('button', { name: 'Archivar handout' }).click();
    await agent.getByText('Handout no disponible.').waitFor();
    await handler.getByRole('button', { name: 'Reabrir borrador' }).click();
    await handler.getByRole('checkbox', { name: 'Permitir descargar desde el visor' }).uncheck();
    await handler.getByRole('button', { name: 'Guardar ficha' }).click();
  } finally {
    await browser.close();
  }
});

test('PDF pages, zoom, text and authorized download work on mobile', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
  try {
    const handler = await browser.newPage();
    const agent = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    await handler.goto(`${origin}/handler`);
    await handler.getByRole('button', { name: 'Entrar como Handler' }).click();
    await handler.getByRole('button', { name: 'Handouts', exact: true }).click();
    await handler.getByRole('button', { name: /Informe en dos páginas/ }).click();
    await handler.getByRole('img', { name: 'Página 1 del PDF' }).waitFor();
    await handler.getByText('Guía de señales ficticia').waitFor();
    await handler.getByRole('button', { name: 'Vista previa como agente' }).click();
    await handler.getByRole('img', { name: 'Página 1 del PDF' }).waitFor();
    assert.equal(await handler.getByText('Guía de señales ficticia').count(), 0);
    assert.equal(await handler.getByRole('link', { name: 'Descargar PDF' }).count(), 0);
    assert.equal(await handler.getByRole('button', { name: 'Imprimir página actual' }).count(), 0);

    await agent.goto(`${origin}/handouts/demo-signal-pdf`);
    await agent.getByRole('button', { name: 'Entrar como agente' }).click();
    await agent.getByText('Handout no disponible.').waitFor();

    await handler.getByRole('checkbox', { name: /Confirmo que esta copia/ }).check();
    await handler.getByRole('button', { name: 'Publicar handout' }).click();
    await agent.getByRole('img', { name: 'Página 1 del PDF' }).waitFor();
    assert.equal(await agent.getByRole('link', { name: 'Descargar PDF' }).count(), 0);
    assert.equal(await agent.getByRole('button', { name: 'Imprimir página actual' }).count(), 0);
    await agent.getByRole('link', { name: 'Evidencia · Marca de recepción' }).waitFor();
    assert.equal(await agent.getByText('Guía de señales ficticia').count(), 0);
    assert.equal(await agent.getByRole('button', { name: 'Página anterior' }).isDisabled(), true);
    await agent.getByRole('button', { name: 'Página siguiente' }).click();
    const second = agent.getByRole('img', { name: 'Página 2 del PDF' });
    await second.waitFor();
    assert.equal(await agent.getByRole('button', { name: 'Página siguiente' }).isDisabled(), true);
    await agent.getByRole('button', { name: 'Acercar' }).click();
    assert.equal(await second.evaluate((item) => item.style.width), '125%');
    assert.equal(await agent.evaluate(() => document.documentElement.scrollWidth), 390);
    await agent.getByText('Texto de esta página').click();
    await agent.getByText(/El segundo turno repitió la medición/).waitFor();

    await handler.getByRole('checkbox', { name: 'Permitir descargar desde el visor' }).check();
    await handler.getByRole('button', { name: 'Guardar ficha' }).click();
    await agent.getByText('Handout no disponible.').waitFor();
    await handler.getByRole('checkbox', { name: /Confirmo que esta copia/ }).check();
    await handler.getByRole('button', { name: 'Publicar handout' }).click();
    await agent.getByRole('button', { name: 'Imprimir página actual' }).waitFor();
    const [download] = await Promise.all([
      agent.waitForEvent('download'),
      agent.getByRole('link', { name: 'Descargar PDF' }).click(),
    ]);
    assert.equal(download.suggestedFilename(), 'handout-demo-signal-pdf.pdf');
    await agent.emulateMedia({ media: 'print' });
    await agent.getByRole('img', { name: 'Página 1 del PDF' }).waitFor();
    assert.equal(await agent.getByRole('button', { name: 'Página siguiente' }).count(), 0);
    await agent.emulateMedia({ media: 'screen' });
    await handler.getByRole('button', { name: 'Archivar handout' }).click();
    await agent.getByText('Handout no disponible.').waitFor();
    await handler.getByRole('button', { name: 'Reabrir borrador' }).click();
    await handler.getByRole('checkbox', { name: 'Permitir descargar desde el visor' }).uncheck();
    await handler.getByRole('button', { name: 'Guardar ficha' }).click();
  } finally {
    await browser.close();
  }
});

const uploadAlt = 'Archivo de prueba del flujo local';

async function openManager(page) {
  await page.goto(`${origin}/handler`);
  await page.getByRole('button', { name: 'Entrar como Handler' }).click();
  await page.getByRole('button', { name: 'Handouts', exact: true }).click();
}

async function chooseRelation(page, label, value) {
  const section = page.getByRole('region', { name: label, exact: true });
  await section.getByLabel(label, { exact: true }).selectOption(value);
  await section.getByRole('button', { name: 'Añadir referencia' }).click();
}

async function publishUpload(handler) {
  await handler.getByRole('checkbox', { name: /Confirmo que esta copia/ }).check();
  await handler.getByRole('button', { name: 'Publicar handout' }).click();
}

test('Handler uploads PNG and PDF drafts, edits references and reopens the files in another session', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
  try {
    const creator = await browser.newPage();
    creator.setDefaultTimeout(15000);
    await openManager(creator);
    const files = [
      { title: 'Carga persistente PNG', name: 'nombre-de-origen-reservado.png', mimeType: 'image/png', buffer: demoImage({ large: true }) },
      { title: 'Carga persistente PDF', name: 'nombre-de-origen-reservado.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await demoPdf({ large: true })) },
    ];
    const ids = [];

    for (const { title, name, mimeType, buffer } of files) {
      const pdf = mimeType === 'application/pdf';
      assert.ok(buffer.length > 2 * 1024 * 1024);
      await creator.getByRole('button', { name: 'Nuevo handout', exact: true }).click();
      const picker = creator.getByLabel('Archivo multimedia');
      if (!pdf) {
        await picker.setInputFiles({ name: 'large.png', mimeType, buffer: Buffer.alloc(20 * 1024 * 1024 + 1) });
        await creator.getByText(/no supere 20 MiB/).waitFor();
        await picker.setInputFiles({ name: 'bad.png', mimeType, buffer: Buffer.from('<svg>') });
        await creator.getByText(/La firma del archivo/).waitFor();
        assert.equal(await creator.getByRole('button', { name: 'Guardar borrador' }).isDisabled(), true);
      }
      await picker.setInputFiles({ name, mimeType, buffer });
      await creator.getByText(new RegExp(name.replace('.', '\\.'))).waitFor();
      await creator.getByRole('button', { name: 'Previsualizar archivo seleccionado' }).click();
      await creator.getByRole('img', { name: pdf ? 'Página 1 del PDF' : 'Vista previa del archivo seleccionado' }).waitFor();
      await creator.getByRole('button', { name: 'Cerrar vista previa del archivo' }).click();
      await creator.getByLabel('Título', { exact: true }).fill(title);
      await creator.getByLabel('Texto alternativo').fill(uploadAlt);
      await creator.getByLabel('Operación', { exact: true }).selectOption('demo-operation');
      await creator.getByLabel('Documento de origen').fill('Fuente reservada de la carga');
      await creator.getByLabel('Página de origen').fill('5');
      await creator.getByLabel('Sección de origen').fill('Sección local');
      await chooseRelation(creator, 'Referencia visible', 'dossiers:demo-report');
      await chooseRelation(creator, 'Referencia visible', 'dossiers:demo-draft');
      await chooseRelation(creator, 'Referencia privada', 'personnel:demo-contact');
      await creator.getByRole('button', { name: 'Guardar borrador' }).click();
      const id = (await creator.getByText(/^Borrador · [A-Za-z0-9]+$/).textContent()).split(' · ')[1];
      ids.push(id);
      await creator.getByRole('img', { name: pdf ? 'Página 1 del PDF' : uploadAlt }).waitFor();
    }
    await creator.close();

    const handler = await browser.newPage();
    const agent = await browser.newPage({ viewport: { width: 390, height: 844 } });
    for (const page of [handler, agent]) page.setDefaultTimeout(15000);
    await openManager(handler);
    for (const [index, { title, mimeType }] of files.entries()) {
      const pdf = mimeType === 'application/pdf';
      await handler.getByRole('button', { name: new RegExp(title) }).click();
      await handler.getByRole('img', { name: pdf ? 'Página 1 del PDF' : uploadAlt }).waitFor();
      await handler.getByText('Fuente reservada de la carga').waitFor();
      await handler.getByRole('link', { name: 'Personal · Elena Vidal' }).waitFor();

      await handler.getByText('Editar procedencia y referencias privadas', { exact: true }).click();
      await handler.getByLabel('Página de origen').fill('7');
      const visible = handler.getByRole('region', { name: 'Referencia visible' });
      await visible.getByRole('button', { name: 'Quitar referencia a Registro de recepción' }).click();
      await chooseRelation(handler, 'Referencia visible', 'clues:demo-signal');
      await handler.getByRole('button', { name: 'Guardar ficha' }).click();
      await handler.getByText('7 · Sección local').waitFor();

      await agent.goto(`${origin}/handouts/${ids[index]}`);
      await agent.getByRole('button', { name: 'Entrar como agente' }).click();
      await agent.getByText('Handout no disponible.').waitFor();
      await publishUpload(handler);
      await agent.getByRole('img', { name: pdf ? 'Página 1 del PDF' : uploadAlt }).waitFor();
      await agent.getByRole('link', { name: 'Evidencia · Marca de recepción' }).waitFor();
      for (const value of ['Fuente reservada de la carga', 'Personal · Elena Vidal', 'nombre-de-origen-reservado']) {
        assert.equal(await agent.getByText(value).count(), 0, value);
      }
      for (const name of ['Expediente · Informe en preparación', 'Expediente · Registro de recepción']) {
        assert.equal(await agent.getByRole('link', { name, exact: true }).count(), 0, name);
      }
      assert.equal(await agent.getByRole('link', { name: /^Descargar/ }).count(), 0);
      if (pdf) {
        await agent.getByRole('button', { name: 'Página siguiente' }).click();
        await agent.getByRole('img', { name: 'Página 2 del PDF' }).waitFor();
      }
      await handler.getByRole('button', { name: 'Archivar handout' }).click();
      await agent.getByText('Handout no disponible.').waitFor();
    }
  } finally {
    await browser.close();
  }
});

test('Handler can cancel a resumable replacement, retry it and restore a prior version', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
  try {
    const handler = await browser.newPage();
    const agent = await browser.newPage();
    for (const page of [handler, agent]) page.setDefaultTimeout(15000);
    await openManager(handler);
    await handler.getByRole('button', { name: /Carga persistente PNG/ }).click();
    await handler.getByRole('button', { name: 'Reabrir borrador' }).click();
    const id = (await handler.getByText(/^Borrador · [A-Za-z0-9]+$/).textContent()).split(' · ')[1];
    await publishUpload(handler);
    await agent.goto(`${origin}/handouts/${id}`);
    await agent.getByRole('button', { name: 'Entrar como agente' }).click();
    await agent.getByRole('img', { name: uploadAlt }).waitFor();

    const pdf = { name: 'replacement.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await demoPdf({ large: true })) };
    const pattern = 'http://127.0.0.1:9199/**';
    let suspended;
    const started = new Promise((resolve) => { suspended = resolve; });
    let continueUpload;
    const release = new Promise((resolve) => { continueUpload = resolve; });
    await handler.route(pattern, async (route) => {
      if (route.request().method() === 'POST' && route.request().headers()['x-goog-upload-protocol'] === 'resumable') {
        suspended();
        await release;
        await route.abort().catch(() => {});
      } else {
        await route.continue();
      }
    });
    await handler.getByLabel('Seleccionar archivo de reemplazo').setInputFiles(pdf);
    try {
      await started;
      await agent.getByText('Handout no disponible.').waitFor();
      await handler.getByRole('button', { name: 'Cancelar carga' }).click();
      await handler.getByText(/Carga cancelada/).waitFor();
    } finally {
      continueUpload();
      await handler.unroute(pattern);
    }
    const retry = handler.getByLabel('Reintentar con el mismo archivo');
    await retry.setInputFiles({ ...pdf, buffer: Buffer.from(await demoPdf()) });
    await handler.getByText('Selecciona la misma copia que inició esta carga.').waitFor();
    await retry.setInputFiles(pdf);
    await handler.getByRole('img', { name: 'Página 1 del PDF' }).waitFor();
    await publishUpload(handler);
    await agent.getByRole('img', { name: 'Página 1 del PDF' }).waitFor();

    await handler.getByRole('button', { name: /Restaurar .*image\/png/ }).click();
    await agent.getByText('Handout no disponible.').waitFor();
    await handler.getByRole('img', { name: uploadAlt }).waitFor();
    await publishUpload(handler);
    await agent.getByRole('img', { name: uploadAlt }).waitFor();
    await handler.getByRole('button', { name: 'Archivar handout' }).click();
    await agent.getByText('Handout no disponible.').waitFor();
  } finally {
    await browser.close();
  }
});

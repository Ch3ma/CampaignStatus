import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright-core';

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

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import { chromium } from 'playwright-core';

const base = '/CampaignStatus/';
const route = '#/expedientes/demo-report';

async function waitFor(url) {
  for (let retry = 0; retry < 60; retry++) {
    if ((await fetch(url).catch(() => null))?.ok) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('No se inició el servidor local de prueba.');
}

test('Pages assets and hash routes work under the project subpath', { timeout: 60000 }, async () => {
  const vite = (args) => spawn(process.execPath, ['node_modules/vite/bin/vite.js', ...args], {
    stdio: 'inherit', env: { ...process.env, VITE_USE_EMULATORS: 'true' },
  });
  const preview = vite(['preview', '--mode', 'pages', '--port', '4179', '--strictPort']);
  const development = vite(['--mode', 'pages', '--port', '4181', '--strictPort']);
  const built = `http://localhost:4179${base}`;
  const local = `http://localhost:4181${base}`;
  let browser;
  try {
    await Promise.all([waitFor(built), waitFor(local)]);
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
    const production = await browser.newPage();
    const productionErrors = [];
    production.on('pageerror', (error) => productionErrors.push(error.message));
    await production.goto(built + route);
    await production.getByText(/Firebase no está disponible|Identificación/).first().waitFor();
    await production.reload();
    assert.equal(production.url(), built + route);
    assert.deepEqual(productionErrors, []);

    const agent = await browser.newPage();
    await agent.goto(local + route);
    await agent.getByRole('button', { name: 'Entrar como agente' }).click();
    await agent.getByRole('heading', { name: 'Registro de recepción' }).waitFor();
    await agent.reload();
    await agent.getByRole('button', { name: 'Entrar como agente' }).click();
    await agent.getByRole('heading', { name: 'Registro de recepción' }).waitFor();
    assert.equal(agent.url(), local + route);
    const skip = agent.getByRole('link', { name: 'Saltar al contenido' });
    await skip.focus();
    await skip.press('Enter');
    assert.equal(await agent.evaluate(() => document.activeElement.id), 'main-content');
    assert.equal(agent.url(), local + route);
    await agent.getByRole('link', { name: 'Evidencias', exact: true }).first().click();
    assert.equal(new URL(agent.url()).hash, '#/evidencias');
  } finally {
    await browser?.close();
    preview.kill();
    development.kill();
  }
});

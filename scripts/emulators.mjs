import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const [mode, ...args] = process.argv.slice(2);
if (!['start', 'exec'].includes(mode)
  || (mode === 'exec' && args.length !== 1)
  || (mode === 'start' && (args.length > 1 || (args.length === 1 && args[0] !== '--persist')))) {
  throw new Error('Invalid local emulator command.');
}

const config = JSON.parse(readFileSync('firebase.json', 'utf8'));
const rules = readFileSync(config.firestore.rules, 'utf8');
const marker = 'return false; // Emulator handout writes';
if (rules.split(marker).length !== 2) throw new Error('Missing emulator rules marker.');

mkdirSync('.firebase', { recursive: true });
config.firestore.rules = '.firebase/firestore.local.rules';
writeFileSync(config.firestore.rules, rules.replace(marker, 'return true;'));
const configPath = '.firebase-emulators.json';
writeFileSync(configPath, JSON.stringify(config));

const flags = [];
if (mode === 'start' && args[0] === '--persist') {
  const directory = '/data/export';
  flags.push(`--export-on-exit=${directory}`);
  if (existsSync(`${directory}/firebase-export-metadata.json`)) flags.push(`--import=${directory}`);
}
if (mode === 'exec') flags.push(args[0]);

const child = spawn(process.execPath, [
  'node_modules/firebase-tools/lib/bin/firebase.js', `emulators:${mode}`,
  '--config', configPath, '--project', 'demo-black-archive', '--only', 'auth,firestore,storage', ...flags,
], { stdio: 'inherit' });

let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    if (!stopping) child.kill('SIGTERM');
    stopping = true;
  });
}
child.on('error', (error) => { console.error(error); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = code ?? (stopping && signal ? 0 : 1); });

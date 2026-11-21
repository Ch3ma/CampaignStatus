import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { relative } from 'node:path';

const files = (await readdir('dist', { recursive: true, withFileTypes: true })).filter((entry) => entry.isFile());
assert(files.length > 0, 'Missing Pages build');
assert.match(await readFile('dist/index.html', 'utf8'), /src="\/CampaignStatus\/assets\//);
for (const entry of files) {
  const name = relative('dist', `${entry.parentPath}/${entry.name}`);
  assert(/^(?:index\.html|assets\/[\w.-]+\.(?:css|m?js))$/.test(name), `Unexpected Pages artifact: ${name}`);
  const data = await readFile(`dist/${name}`, 'utf8');
  assert(!/http:\/\/127\.0\.0\.1:(?:9099|9199|8080)|handler@example\.test|archive-demo-handler|archive-demo-agent|BEGIN [A-Z ]*PRIVATE KEY|\x22private_key(?:_id)?\x22\s*:|\x22type\x22\s*:\s*\x22service_account\x22/i.test(data),
    `Local configuration or credential marker in ${entry.name}`);
}
console.log(`Pages build checked (${files.length} files).`);

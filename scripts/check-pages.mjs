import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const files = (await readdir('dist', { recursive: true, withFileTypes: true })).filter((entry) => entry.isFile());
assert(files.length > 0, 'Missing Pages build');
assert.match(await readFile('dist/index.html', 'utf8'), /src="\/CampaignStatus\/assets\//);
for (const entry of files) {
  assert(!/\.(pdf|png|jpe?g|webp|map|pem|key)$/i.test(entry.name), `Unexpected artifact type: ${entry.name}`);
  const data = await readFile(`${entry.parentPath}/${entry.name}`, 'utf8');
  assert(!/http:\/\/127\.0\.0\.1:(?:9099|9199|8080)|handler@example\.test|archive-demo-handler|archive-demo-agent|BEGIN [A-Z ]*PRIVATE KEY/i.test(data),
    `Local configuration or credential marker in ${entry.name}`);
}
console.log(`Pages build checked (${files.length} files).`);

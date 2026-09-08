// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 Lukasz Krzemien (biuro@softspark.eu)
// Source: https://github.com/softspark/dsh-web-search-searxng

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (relativePath) =>
  JSON.parse(await readFile(resolve(root, relativePath), 'utf8'));

const packageJson = await readJson('package.json');
const packageLock = await readJson('package-lock.json');
// The KB carries the module version in every document's frontmatter, so a
// release that forgets one leaves a document claiming to describe a version
// that never existed.
const kbVersions = await collectKbVersions(resolve(root, 'kb'));
const versions = new Map([
  ['package.json', packageJson.version],
  ['package-lock.json', packageLock.version],
  ['package-lock.json packages[""]', packageLock.packages?.['']?.version],
  ...kbVersions,
]);

let failed = false;
const major = Number.parseInt(packageJson.version.split('.')[0] ?? '', 10);
if (!Number.isInteger(major) || major < 1) {
  console.error(`SoftSpark public modules must start at 1.0.0 or later, got ${packageJson.version}`);
  failed = true;
}
for (const [source, version] of versions) {
  if (version !== packageJson.version) {
    console.error(`${source} version ${String(version)} does not match ${packageJson.version}`);
    failed = true;
  }
}

const tagIndex = process.argv.indexOf('--tag');
if (tagIndex >= 0) {
  const tag = process.argv[tagIndex + 1];
  const expectedTag = `v${packageJson.version}`;
  if (tag !== expectedTag) {
    console.error(`Release tag ${String(tag)} does not match ${expectedTag}`);
    failed = true;
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(`Version surfaces match ${packageJson.version}`);
}

async function collectKbVersions(directory) {
  const { readdir } = await import('node:fs/promises');
  const found = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await collectKbVersions(path)));
      continue;
    }
    if (!entry.name.endsWith('.md')) continue;
    const version = (await readFile(path, 'utf8')).match(/^version: "([^"]+)"$/mu)?.[1];
    found.push([`kb/${entry.name}`, version]);
  }
  return found;
}

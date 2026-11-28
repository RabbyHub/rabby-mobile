#!/usr/bin/env node
/**
 * Print the per-file manifest used by hash.mjs, so two builds can be diffed
 * file by file when their tree hashes disagree.
 *
 *   node scripts/unsigned/manifest.mjs <app-tree> > manifest.txt
 *
 * Plists and asset catalogs are hashed by semantic content, exactly like the
 * attestation, so the diff only shows real differences.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { structuralDigest } from './structural.mjs';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: manifest.mjs <app-tree>');
  process.exit(2);
}

function walk(current, base, out) {
  for (const entry of fs
    .readdirSync(current, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    if (entry.name === '.DS_Store') continue;
    const abs = path.join(current, entry.name);
    if (entry.isDirectory()) walk(abs, base, out);
    else if (entry.isFile()) out.push({ abs, rel: path.relative(base, abs) });
  }
}

const sha256 = file =>
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function plistSemantic(file) {
  const xml = execFileSync('plutil', ['-convert', 'xml1', '-o', '-', file], {
    maxBuffer: 64 * 1024 * 1024,
  }).toString('utf8');
  return crypto
    .createHash('sha256')
    .update(
      xml.replace(
        /(<key>BuildMachineOSBuild<\/key>\s*<string>)[^<]*(<\/string>)/g,
        '$1/rabby-build-host$2',
      ),
    )
    .digest('hex');
}

function assetCatalogSemantic(file) {
  const info = execFileSync('xcrun', ['assetutil', '--info', file], {
    maxBuffer: 128 * 1024 * 1024,
  }).toString('utf8');
  const stripped = JSON.parse(info).map(entry => {
    // Timestamp is the wall clock; DumpToolVersion comes from the host's CoreUI.
    const { Timestamp, DumpToolVersion, ...rest } = entry;
    return rest;
  });
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(stripped))
    .digest('hex');
}

function bundleExecutable(root) {
  try {
    return execFileSync(
      'plutil',
      ['-extract', 'CFBundleExecutable', 'raw', path.join(root, 'Info.plist')],
      { encoding: 'utf8' },
    ).trim();
  } catch {
    return null;
  }
}

const root = path.resolve(dir);
const executable = bundleExecutable(root);
const files = [];
walk(root, root, files);
const lines = files
  .map(({ abs, rel }) => {
    const base = path.basename(abs);
    let digest = sha256(abs);
    if (executable && rel.split(path.sep).join('/') === executable) {
      digest = structuralDigest(abs);
    } else if (base === 'Assets.car') digest = assetCatalogSemantic(abs);
    else if (base.endsWith('.plist')) digest = plistSemantic(abs);
    return `${digest}  ${rel.split(path.sep).join('/')}`;
  })
  .sort();
process.stdout.write(`${lines.join('\n')}\n`);

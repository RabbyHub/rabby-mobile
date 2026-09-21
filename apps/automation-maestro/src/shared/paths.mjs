import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const sharedRoot = __dirname;
export const srcRoot = path.resolve(sharedRoot, '..');
export const maestroRoot = path.resolve(srcRoot, '..');
export const repoRoot = path.resolve(maestroRoot, '..', '..');

export function resolveFromMaestro(...parts) {
  return path.resolve(maestroRoot, ...parts);
}

export function resolveFromRepo(...parts) {
  return path.resolve(repoRoot, ...parts);
}

export function toFileHref(filePath) {
  return pathToFileURL(filePath).href;
}

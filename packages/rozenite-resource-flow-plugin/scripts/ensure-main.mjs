import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');
const mainEntryPath = path.join(distDir, 'index.js');

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(mainEntryPath, 'export {};\n', 'utf8');

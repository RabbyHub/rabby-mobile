import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { maestroRoot } from './paths.mjs';

const DEFAULT_ENV_DIRS = [maestroRoot];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  return parseEnv(raw);
}

export function appendCsvEnvValue(varName, value) {
  const currentValue = process.env[varName]?.trim();

  if (!currentValue) {
    process.env[varName] = value;
    return;
  }

  const values = currentValue
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  if (values.includes(value)) {
    return;
  }

  values.push(value);
  process.env[varName] = values.join(',');
}

export function loadLocalEnv({ envDirs = DEFAULT_ENV_DIRS } = {}) {
  const inheritedKeys = new Set(Object.keys(process.env));
  const profile = process.env.RABBY_MAESTRO_ENV?.trim();

  const envFilenames = [
    '.env',
    '.env.local',
    ...(profile ? [`.env.${profile}`, `.env.${profile}.local`] : []),
  ];

  for (const envDir of envDirs) {
    for (const filename of envFilenames) {
      const filePath = path.join(envDir, filename);
      const parsed = parseEnvFile(filePath);
      if (!parsed) {
        continue;
      }

      for (const [key, value] of Object.entries(parsed)) {
        if (inheritedKeys.has(key)) {
          continue;
        }

        process.env[key] = value;
      }
    }
  }

  for (const host of ['localhost', '127.0.0.1', '::1']) {
    appendCsvEnvValue('NO_PROXY', host);
    appendCsvEnvValue('no_proxy', host);
  }
}

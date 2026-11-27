import {
  DocumentDirectoryPath,
  ExternalDirectoryPath,
  mkdir,
  readFile,
  writeFile,
} from '@rabby-wallet/react-native-fs';
import { Platform } from 'react-native';

/**
 * Route-param capture/replay for screens whose real data is a large object
 * (bridge records, transaction groups, quote payloads).
 *
 * Capturing the params of a real flow and replaying them keeps the structure
 * authentic — hand-written minimal objects only move the next crash.
 */
// Android regression builds are not debuggable, so an app-private Documents
// directory cannot receive host-pushed fixtures. Use the external files dir on
// Android, matching the biz-mock runner's push target.
const FIXTURE_BASE_DIR =
  Platform.OS === 'android' ? ExternalDirectoryPath : DocumentDirectoryPath;
const FIXTURE_DIR = `${FIXTURE_BASE_DIR}/screen-registry-fixtures`;

function safeName(name: string) {
  return name.replace(/[^\w.-]/g, '_').slice(0, 80) || 'fixture';
}

export function getRouteFixturePath(name: string) {
  return `${FIXTURE_DIR}/${safeName(name)}.json`;
}

export async function dumpRouteParams(
  routeName: string | undefined,
  params: Record<string, unknown> | undefined,
  name?: string,
) {
  await mkdir(FIXTURE_DIR);
  const fileName = safeName(name || routeName || 'route');
  const filePath = getRouteFixturePath(fileName);
  const payload = {
    route: routeName ?? null,
    capturedAt: Date.now(),
    params: params ?? {},
  };
  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
  console.log('[screenRegistry] route params dumped', fileName);
  return filePath;
}

export async function readRouteFixture(name: string) {
  const raw = await readFile(getRouteFixturePath(name), 'utf8');
  const parsed = JSON.parse(raw);
  const params = parsed?.params ?? parsed;
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new Error(`route fixture "${name}" has no params object`);
  }
  return params as Record<string, unknown>;
}

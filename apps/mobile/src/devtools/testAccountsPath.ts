/**
 * Pure helpers for the non-production `debug-import-test-accounts` seed file.
 *
 * The deeplink is reachable from any app/web page, and the import deletes the
 * file after reading it. Only a fixed, app-owned filename inside the app's
 * container may be used; an arbitrary `path=` must be rejected before any
 * read/unlink happens.
 */
export const TEST_ACCOUNTS_FILENAME = 'kpi-test-accounts.txt';

function normalize(value: string) {
  // `/sdcard` is the same volume as `/storage/emulated/0` on Android, but the
  // adb push path uses the former while RNFS reports the latter.
  return value
    .replace(/^\/sdcard\//, '/storage/emulated/0/')
    .replace(/\/+/g, '/');
}

export function expectedTestAccountsPath(baseDir: string) {
  return `${baseDir.replace(/\/+$/, '')}/${TEST_ACCOUNTS_FILENAME}`;
}

export function isAllowedTestAccountsPath(
  candidate: string | undefined,
  baseDir: string,
) {
  if (!candidate || candidate.includes('\0') || candidate.includes('..')) {
    return false;
  }
  return normalize(candidate) === normalize(expectedTestAccountsPath(baseDir));
}

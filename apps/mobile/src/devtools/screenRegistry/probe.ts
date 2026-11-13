import {
  appendFile,
  DocumentDirectoryPath,
} from '@rabby-wallet/react-native-fs';

const PROBE_FILE = `${DocumentDirectoryPath}/screen-registry-probe.log`;

let pending: Promise<void> = Promise.resolve();

/**
 * Appends one `debug-open-screen` outcome to a file inside the app sandbox.
 *
 * Device sweeps run headless. On Android the JS console is visible in logcat,
 * but on iOS it only reaches Metro, so the sweep host reads this file from the
 * app container (`xcrun simctl get_app_container ... data`) instead.
 */
export function recordScreenOpenProbe(screenId: string, opened: boolean) {
  const line = `${Date.now()} screen=${screenId} opened=${opened}\n`;
  pending = pending
    .then(() => appendFile(PROBE_FILE, line, 'utf8'))
    .catch(() => {
      // The probe must never affect navigation.
    });
  return pending;
}

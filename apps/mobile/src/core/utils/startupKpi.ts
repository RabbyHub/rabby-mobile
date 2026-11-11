import { NativeModules } from 'react-native';

type Route = 'unlock' | 'home';

const StartupKpi = NativeModules.StartupKpi as
  | { markFirstContentFrame: (route: string) => void }
  | undefined;

const jsT0 =
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

let reported = false;

function now() {
  return typeof performance !== 'undefined' &&
    typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/**
 * First user-visible content frame. Not every cold start lands on the unlock
 * screen - some land on Home - so `route` records which surface won, and only
 * the first call reports.
 *
 * The native module measures from `Process.getStartElapsedRealtime()` so the
 * native start and bundle load are included; `js_ms` is kept as a fallback and
 * as a second data point.
 */
export function markFirstContentFrame(route: Route) {
  if (reported) return;
  reported = true;
  const jsMs = Math.round(now() - jsT0);
  console.info(`[StartupKpi] first_content_frame js_ms=${jsMs} route=${route}`);
  try {
    StartupKpi?.markFirstContentFrame(route);
  } catch {
    // Native module is optional (iOS / unit tests).
  }
}

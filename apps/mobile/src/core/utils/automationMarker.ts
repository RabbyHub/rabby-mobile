import { NativeModules } from 'react-native';

type NativeMarker = { logMarker?: (name: string, detail: string) => void };

/**
 * Device-automation marker.
 *
 * Release-like iOS builds drop `console.log` (only warn/error reach the
 * unified log), so a simulator runner cannot see a JS-side "done" line. This
 * mirrors the marker into the native log through the StartupKpi module, which
 * the seeding scripts read:
 *
 *   automation_marker name=<name> detail=<detail>
 *
 * It is only called from non-production debug commands, and the native module
 * is optional, so it is a no-op elsewhere.
 */
export function markAutomation(name: string, detail = '') {
  try {
    (NativeModules.StartupKpi as NativeMarker | undefined)?.logMarker?.(
      name,
      detail,
    );
  } catch {
    // native module is optional (Android / unit tests)
  }
}

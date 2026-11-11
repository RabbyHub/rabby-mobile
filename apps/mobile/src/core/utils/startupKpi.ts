import { InteractionManager } from 'react-native';

type Route = 'unlock' | 'home';

const t0 =
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

let reported = false;

/**
 * First user-visible content frame metric.
 *
 * `route` records which surface won the race: not every cold start lands on
 * the unlock screen, some land on Home, and both are valid first content.
 * Only the first call is reported so the two call sites cannot double count.
 */
export function markFirstContentFrame(route: Route) {
  if (reported) return;
  reported = true;
  const jsMs = Math.round(
    (typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now()) - t0,
  );
  // Stable, greppable and independent of __DEV__ / diagnostics switches:
  // release and regression packages must both emit it.
  console.info(`[StartupKpi] first_content_frame js_ms=${jsMs} route=${route}`);
}

export function reportFirstContentFrameAfterInteractions(route: Route) {
  InteractionManager.runAfterInteractions(() => markFirstContentFrame(route));
}

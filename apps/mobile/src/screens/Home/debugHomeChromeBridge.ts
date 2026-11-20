import { zCreate } from '@/core/utils/reexports';
import { IS_IOS } from '@/core/native/utils';

/**
 * Non-production switch for the home tab chrome's sample-stream bridge (QA 1414).
 *
 * #2395 replaced the raw ~60Hz `onPageScroll` sample stream with a
 * `withTiming`-extrapolated shared value (and an always-on per-frame callback)
 * so the header/tab chrome tracks the pager. That was tuned on Android; on iOS
 * we want to fall back to the previous raw sample stream so we can A/B whether
 * the bridge itself is the source of the iOS jank.
 *
 * - `auto` (default): Android keeps the bridge (`on`), iOS uses the previous
 *   raw stream (`off`).
 * - `on`  : force the bridged stream on every platform.
 * - `off` : force the previous raw stream on every platform.
 *
 * Debug deep link:
 *   ...&_cmd=toggle-home-chrome-bridge                 (flip effective behaviour)
 *   ...&_cmd=toggle-home-chrome-bridge&value=on|off|auto   (pin a mode)
 */
export type HomeChromeBridgeMode = 'auto' | 'on' | 'off';

const homeChromeBridgeStore = zCreate<{ mode: HomeChromeBridgeMode }>(() => ({
  mode: 'auto',
}));

export function useHomeChromeBridgeMode() {
  return homeChromeBridgeStore(s => s.mode);
}

/**
 * `true` = legacy raw sample stream: no `withTiming` bridge and no always-on
 * per-frame callback.
 */
export function useLegacyHomeChromeBridge() {
  const mode = useHomeChromeBridgeMode();
  if (mode === 'on') {
    return false;
  }
  if (mode === 'off') {
    return true;
  }
  // `auto`: Android uses the tuned bridge, iOS falls back to the raw stream.
  return IS_IOS;
}

export const debugHomeChromeBridge = {
  get mode(): HomeChromeBridgeMode {
    return homeChromeBridgeStore.getState().mode;
  },
  get legacy(): boolean {
    if (this.mode === 'on') {
      return false;
    }
    if (this.mode === 'off') {
      return true;
    }
    return IS_IOS;
  },
  set(mode: HomeChromeBridgeMode) {
    if (homeChromeBridgeStore.getState().mode === mode) {
      return;
    }
    homeChromeBridgeStore.setState({ mode });
  },
  toggle() {
    this.set(this.legacy ? 'on' : 'off');
  },
};

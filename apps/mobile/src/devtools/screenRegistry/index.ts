import { CommonActions } from '@react-navigation/native';

import { navigationRef } from '@/utils/navigation';
import {
  SCREEN_REGISTRY,
  REGISTERED_SCREEN_IDS,
  type RegisteredScreenId,
} from './screens.gen';
import { applyInjectedStore } from './storeInjection';

export type { RegisteredScreenId };
export { REGISTERED_SCREEN_IDS, SCREEN_REGISTRY };

export function isRegisteredScreenId(
  value: string,
): value is RegisteredScreenId {
  return Object.prototype.hasOwnProperty.call(SCREEN_REGISTRY, value);
}

export function listRegisteredScreens() {
  return REGISTERED_SCREEN_IDS.map(id => {
    const entry = SCREEN_REGISTRY[id];
    return { id, chain: entry.chain, navigator: entry.navigator };
  });
}

/**
 * Opens any navigator-registered screen directly.
 *
 * The registry records the route chain (root -> ... -> screen), so the whole
 * chain is pushed as nested navigation params. That keeps `goBack()` meaningful
 * without replaying the long product flow that normally leads to the screen.
 */
export function openScreenById(
  id: string,
  params: Record<string, unknown> = {},
) {
  if (!isRegisteredScreenId(id)) {
    console.warn(
      `[screenRegistry] unknown screen "${id}". Use listRegisteredScreens().`,
    );
    return false;
  }

  const entry = SCREEN_REGISTRY[id];
  const chain = entry.chain;

  if (chain.length === 1) {
    navigationRef.dispatch(CommonActions.navigate(chain[0], params));
    return true;
  }

  const [rootRoute, ...rest] = chain;
  let nested: Record<string, unknown> = params;
  for (let index = rest.length - 1; index >= 0; index -= 1) {
    nested = { screen: rest[index], params: nested };
  }
  navigationRef.dispatch(CommonActions.navigate(rootRoute, nested));
  return true;
}

export type OpenScreenRequest = {
  screen: string;
  params?: Record<string, unknown>;
  store?: Record<string, unknown>;
};

/**
 * Entry point used by the `debug-open-screen` deeplink. Store overrides are
 * applied before navigating so the screen mounts with the injected state.
 */
export async function openScreenForDebug(request: OpenScreenRequest) {
  if (request.store && Object.keys(request.store).length > 0) {
    await applyInjectedStore(request.store);
  }
  return openScreenById(request.screen, request.params ?? {});
}

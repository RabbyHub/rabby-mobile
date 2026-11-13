import { CommonActions, StackActions } from '@react-navigation/native';

import { navigationRef } from '@/utils/navigation';
import {
  SCREEN_REGISTRY,
  REGISTERED_SCREEN_IDS,
  type RegisteredScreenId,
} from './screens.gen';
import { resolveScreenFixture } from './screenFixtures';
import { recordScreenOpenProbe } from './probe';
import { withInjectedPropsParam } from './screenInjection';
import {
  applyInjectedStore,
  clearInjectedStorePins,
  pinInjectedStore,
} from './storeInjection';

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
 * Resolves once the root navigator is mounted, or after `timeoutMs`.
 *
 * A cold-start deeplink (`getInitialURL`) is delivered before the
 * NavigationContainer mounts, especially on iOS. Polling `isReady()` keeps the
 * debug entry points independent of the app's boot ordering.
 */
function waitForNavigationReady(timeoutMs = 15_000): Promise<boolean> {
  if (navigationRef.isReady()) {
    return Promise.resolve(true);
  }
  return new Promise(resolve => {
    const startedAt = Date.now();
    const poll = setInterval(() => {
      if (navigationRef.isReady()) {
        clearInterval(poll);
        resolve(true);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(poll);
        resolve(false);
      }
    }, 100);
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
  options: { push?: boolean; probe?: boolean } = {},
) {
  if (!isRegisteredScreenId(id)) {
    console.warn(
      `[screenRegistry] unknown screen "${id}". Use listRegisteredScreens().`,
    );
    if (options.probe) {
      void recordScreenOpenProbe(id, false);
    }
    return false;
  }

  const entry = SCREEN_REGISTRY[id];
  const chain = entry.chain;

  // Fill the params the screen reads but the route type calls optional, then let
  // explicit params win.
  const paramsWithFixture = { ...resolveScreenFixture(id), ...params };
  params = paramsWithFixture;

  // Requirement contract comes from src/navigation-type.ts, so a missing param
  // fails here with a readable message instead of throwing inside the screen.
  const missing = entry.params.filter(
    key => !Object.prototype.hasOwnProperty.call(params, key),
  );
  const riskyMissing = entry.riskyParams.filter(
    key => !Object.prototype.hasOwnProperty.call(params, key),
  );
  if (riskyMissing.length > 0) {
    console.warn(
      `[screenRegistry] "${id}" reads optional param(s) without a default: ${riskyMissing.join(
        ', ',
      )} - pass them in params to render reliably.`,
    );
  }

  if (missing.length > 0) {
    console.warn(
      `[screenRegistry] "${id}" is missing required param(s): ${missing.join(
        ', ',
      )}. optional: ${entry.optionalParams.join(', ') || 'none'}`,
    );
    if (options.probe) {
      void recordScreenOpenProbe(id, false);
    }
    return false;
  }

  const [rootRoute, ...rest] = chain;
  let nested: Record<string, unknown> = paramsWithFixture;
  for (let index = rest.length - 1; index >= 0; index -= 1) {
    nested = { screen: rest[index], params: nested };
  }

  const openOnceReady = () => {
    // `navigate` reuses an existing route; scenario steps rely on `push` so the
    // same screen can be opened repeatedly with a fresh entry.
    navigationRef.dispatch(
      options.push
        ? StackActions.push(rootRoute, rest.length ? nested : paramsWithFixture)
        : CommonActions.navigate(
            rootRoute,
            rest.length ? nested : paramsWithFixture,
          ),
    );
    if (options.probe) {
      void recordScreenOpenProbe(id, true);
    }
  };

  if (!navigationRef.isReady()) {
    // Cold-start deeplinks arrive before the navigation container mounts.
    void waitForNavigationReady().then(ready => {
      if (ready) {
        openOnceReady();
      } else {
        console.warn(
          `[screenRegistry] navigator never became ready; dropped "${id}"`,
        );
      }
    });
    return true;
  }

  openOnceReady();
  return true;
}

export type OpenScreenRequest = {
  screen: string;
  params?: Record<string, unknown>;
  /** Read route params from a `debug-dump-route` fixture (inline params win). */
  paramsFile?: string;
  /** Non-route props merged into the first mount of that screen (non-production only). */
  props?: Record<string, unknown>;
  store?: Record<string, unknown>;
  /** Sticky store patch, re-applied after every producer write. */
  storePin?: Record<string, unknown>;
  /** Clears every active store pin before opening. */
  storePinClear?: boolean;
  /** Push a new entry instead of reusing an existing route (scenario steps). */
  push?: boolean;
};

/**
 * Entry point used by the `debug-open-screen` deeplink. Store overrides are
 * applied before navigating so the screen mounts with the injected state.
 */
export async function openScreenForDebug(request: OpenScreenRequest) {
  if (request.storePinClear) {
    clearInjectedStorePins();
  }
  if (request.store && Object.keys(request.store).length > 0) {
    await applyInjectedStore(request.store);
  }
  if (request.storePin && Object.keys(request.storePin).length > 0) {
    await pinInjectedStore(request.storePin);
  }

  let params = request.params ?? {};
  if (request.paramsFile) {
    try {
      const { readRouteFixture } = await import('./routeFixtures');
      params = { ...(await readRouteFixture(request.paramsFile)), ...params };
    } catch (error) {
      console.warn(
        `[screenRegistry] paramsFile "${request.paramsFile}" could not be read; using inline params only`,
        error,
      );
    }
  }

  return openScreenById(
    request.screen,
    withInjectedPropsParam(params, request.props),
    {
      push: request.push,
      probe: true,
    },
  );
}

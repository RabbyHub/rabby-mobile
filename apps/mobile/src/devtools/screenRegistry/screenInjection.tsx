import React from 'react';

import { isNonPublicProductionEnv } from '@/constant';

/**
 * Reserved route param that carries screen-level prop injection.
 *
 * React Navigation scopes params to a single route instance, so the injection
 * follows exactly the entry the debug deeplink opened: it survives re-renders
 * and extra mounts, and a later normal navigation to the same screen does not
 * inherit it.
 */
export const SCREEN_INJECTED_PROPS_PARAM = '__debugInjectedProps';

const RESERVED_PROP_KEYS = new Set(['route', 'navigation']);

type RouteLike = {
  name?: string;
  params?: Record<string, unknown> & {
    [SCREEN_INJECTED_PROPS_PARAM]?: Record<string, unknown>;
  };
};

/** Adds the injection to the params of the route about to be opened. */
export function withInjectedPropsParam(
  params: Record<string, unknown> = {},
  injectedProps: Record<string, unknown> | undefined,
) {
  if (!isNonPublicProductionEnv || !injectedProps) {
    return params;
  }
  const injectable = Object.fromEntries(
    Object.entries(injectedProps).filter(
      ([key]) => !RESERVED_PROP_KEYS.has(key),
    ),
  );
  if (Object.keys(injectable).length === 0) {
    return params;
  }
  return {
    ...params,
    [SCREEN_INJECTED_PROPS_PARAM]: injectable,
  };
}

/**
 * Non-production only: merges the injected props into the screen's props.
 *
 * Production returns the component unchanged (no wrapper, no runtime cost), so
 * shipping code cannot observe injection behaviour at all.
 *
 * This cannot set `useState` values the screen already initialised — seed the
 * store (`store=`) instead, or drive the UI.
 */
export function withScreenPropsInjection<P extends object>(
  Component: React.ComponentType<P>,
): React.ComponentType<P> {
  if (!isNonPublicProductionEnv) {
    return Component;
  }

  function ScreenPropsInjectionBoundary(props: P) {
    const route = (props as { route?: RouteLike }).route;
    const injected = route?.params?.[SCREEN_INJECTED_PROPS_PARAM];
    if (!injected || Object.keys(injected).length === 0) {
      return React.createElement(Component, props);
    }

    // Keep the reserved key out of the props the screen sees directly.
    const { [SCREEN_INJECTED_PROPS_PARAM]: _reserved, ...visibleParams } =
      route?.params ?? {};
    const routeForScreen = route ? { ...route, params: visibleParams } : route;

    return React.createElement(Component, {
      ...props,
      ...injected,
      route: routeForScreen,
    } as P);
  }

  ScreenPropsInjectionBoundary.displayName = `withScreenPropsInjection(${
    Component.displayName || Component.name || 'Screen'
  })`;

  return ScreenPropsInjectionBoundary;
}

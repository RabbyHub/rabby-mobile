import type React from 'react';

import {
  serviceDependency,
  withCoreServices,
} from '@/core/serviceApi/serviceDependencies';
import type {
  CoreServiceInjectedProps,
  ResolvedCoreServices,
  WithCoreServicesOptions,
} from '@/core/serviceApi/serviceDependencies';

export const BACKGROUND_BRIDGE_SERVICE_DEPENDENCIES = [
  serviceDependency('dappService'),
  serviceDependency('sessionService'),
] as const;

export type BackgroundBridgeServices = ResolvedCoreServices<
  typeof BACKGROUND_BRIDGE_SERVICE_DEPENDENCIES
>;

export type BackgroundBridgeServiceInjectedProps = CoreServiceInjectedProps<
  typeof BACKGROUND_BRIDGE_SERVICE_DEPENDENCIES
>;

export function withBackgroundBridgeServices<
  Props extends BackgroundBridgeServiceInjectedProps,
>(
  Component: React.ComponentType<Props>,
  options: WithCoreServicesOptions<
    Omit<Props, keyof BackgroundBridgeServiceInjectedProps>
  > = {},
) {
  return withCoreServices(
    BACKGROUND_BRIDGE_SERVICE_DEPENDENCIES,
    Component,
    options,
  );
}

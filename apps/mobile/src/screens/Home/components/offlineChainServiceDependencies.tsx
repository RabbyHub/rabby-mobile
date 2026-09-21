import React from 'react';

import {
  serviceDependency,
  withPreparedCoreServices,
} from '@/core/serviceApi/serviceDependencies';
import type {
  CoreServiceInjectedProps,
  ResolvedCoreServices,
  WithCoreServicesOptions,
} from '@/core/serviceApi/serviceDependencies';
import { prepareOfflineChainStoreFromService } from './offlineChainState';

export const OFFLINE_CHAIN_SERVICE_DEPENDENCIES = [
  serviceDependency('offlineChainService'),
] as const;

type OfflineChainServices = ResolvedCoreServices<
  typeof OFFLINE_CHAIN_SERVICE_DEPENDENCIES
>;

function prepareOfflineChainState(services: OfflineChainServices) {
  prepareOfflineChainStoreFromService(services.offlineChainService);
}

export function withOfflineChainService<Props extends object>(
  Component: React.ComponentType<Props>,
  options: WithCoreServicesOptions<Props> = {},
): React.ComponentType<Props> {
  type InjectedProps = {
    componentProps: Props;
  } & CoreServiceInjectedProps<typeof OFFLINE_CHAIN_SERVICE_DEPENDENCIES>;

  const Ready: React.FC<InjectedProps> = ({ componentProps }) => (
    <Component {...componentProps} />
  );
  Ready.displayName = `OfflineChainServiceProvider(${
    Component.displayName || Component.name || 'Component'
  })`;

  const PreparedBoundary = withPreparedCoreServices(
    OFFLINE_CHAIN_SERVICE_DEPENDENCIES,
    Ready,
    {
      prepare: prepareOfflineChainState,
      fallback: props =>
        typeof options.fallback === 'function'
          ? options.fallback(props.componentProps)
          : options.fallback,
      renderError: options.renderError,
    },
  );

  const Wrapped: React.FC<Props> = props => (
    <PreparedBoundary componentProps={props} />
  );
  Wrapped.displayName = `withOfflineChainService(${
    Component.displayName || Component.name || 'Component'
  })`;
  return Wrapped;
}

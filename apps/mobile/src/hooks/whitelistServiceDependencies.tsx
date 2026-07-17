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
import { prepareWhitelistStoreFromService } from './whitelist';

export const WHITELIST_SERVICE_DEPENDENCIES = [
  serviceDependency('whitelistService'),
] as const;

export type WhitelistServices = ResolvedCoreServices<
  typeof WHITELIST_SERVICE_DEPENDENCIES
>;

const WhitelistServicesContext = React.createContext<
  WhitelistServices | undefined
>(undefined);

export function useWhitelistService() {
  const services = React.useContext(WhitelistServicesContext);
  if (!services) {
    throw new Error(
      'useWhitelistService must be used inside a whitelist service boundary',
    );
  }
  return services.whitelistService;
}

function prepareWhitelistState(services: WhitelistServices) {
  prepareWhitelistStoreFromService(services.whitelistService);
}

export function withWhitelistService<Props extends object>(
  Component: React.ComponentType<Props>,
  options: WithCoreServicesOptions<Props> = {},
): React.ComponentType<Props> {
  type InjectedProps = {
    componentProps: Props;
  } & CoreServiceInjectedProps<typeof WHITELIST_SERVICE_DEPENDENCIES>;

  const Provider: React.FC<InjectedProps> = ({
    coreServices,
    componentProps,
  }) => (
    <WhitelistServicesContext.Provider value={coreServices}>
      <Component {...componentProps} />
    </WhitelistServicesContext.Provider>
  );

  Provider.displayName = `WhitelistServicesProvider(${
    Component.displayName || Component.name || 'Component'
  })`;

  const PreparedProvider = withPreparedCoreServices(
    WHITELIST_SERVICE_DEPENDENCIES,
    Provider,
    {
      prepare: prepareWhitelistState,
      fallback: props =>
        typeof options.fallback === 'function'
          ? options.fallback(props.componentProps)
          : options.fallback,
      renderError: options.renderError,
    },
  );

  const Wrapped: React.FC<Props> = props => (
    <PreparedProvider componentProps={props} />
  );
  Wrapped.displayName = `withWhitelistService(${
    Component.displayName || Component.name || 'Component'
  })`;
  return Wrapped;
}

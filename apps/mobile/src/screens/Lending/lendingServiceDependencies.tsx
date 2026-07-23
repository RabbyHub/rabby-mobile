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
import { prepareLendingStoreFromService } from './hooks/useLendingService';

export const LENDING_SERVICE_DEPENDENCIES = [
  serviceDependency('lendingService'),
] as const;

export type LendingServices = ResolvedCoreServices<
  typeof LENDING_SERVICE_DEPENDENCIES
>;

const LendingServicesContext = React.createContext<LendingServices | undefined>(
  undefined,
);

export function useConcreteLendingService() {
  const services = React.useContext(LendingServicesContext);
  if (!services) {
    throw new Error(
      'useConcreteLendingService must be used inside a lending service boundary',
    );
  }
  return services.lendingService;
}

function prepareLendingState(services: LendingServices) {
  prepareLendingStoreFromService(services.lendingService);
}

export function withLendingService<Props extends object>(
  Component: React.ComponentType<Props>,
  options: WithCoreServicesOptions<Props> = {},
): React.ComponentType<Props> {
  type InjectedProps = {
    componentProps: Props;
  } & CoreServiceInjectedProps<typeof LENDING_SERVICE_DEPENDENCIES>;

  const Provider: React.FC<InjectedProps> = ({
    coreServices,
    componentProps,
  }) => (
    <LendingServicesContext.Provider value={coreServices}>
      <Component {...componentProps} />
    </LendingServicesContext.Provider>
  );

  Provider.displayName = `LendingServicesProvider(${
    Component.displayName || Component.name || 'Component'
  })`;

  const PreparedProvider = withPreparedCoreServices(
    LENDING_SERVICE_DEPENDENCIES,
    Provider,
    {
      prepare: prepareLendingState,
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
  Wrapped.displayName = `withLendingService(${
    Component.displayName || Component.name || 'Component'
  })`;
  return Wrapped;
}

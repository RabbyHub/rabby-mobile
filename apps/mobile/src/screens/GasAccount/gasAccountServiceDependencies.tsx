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
import { prepareGasAccountStoreFromService } from './hooks/atom';

export const GAS_ACCOUNT_SERVICE_DEPENDENCIES = [
  serviceDependency('gasAccountService'),
] as const;

export type GasAccountServices = ResolvedCoreServices<
  typeof GAS_ACCOUNT_SERVICE_DEPENDENCIES
>;

const GasAccountServicesContext = React.createContext<
  GasAccountServices | undefined
>(undefined);

export function useGasAccountService() {
  const services = React.useContext(GasAccountServicesContext);
  if (!services) {
    throw new Error(
      'useGasAccountService must be used inside a gas account service boundary',
    );
  }
  return services.gasAccountService;
}

function prepareGasAccountState(services: GasAccountServices) {
  prepareGasAccountStoreFromService(services.gasAccountService);
}

export function withGasAccountService<Props extends object>(
  Component: React.ComponentType<Props>,
  options: WithCoreServicesOptions<Props> = {},
): React.ComponentType<Props> {
  type InjectedProps = {
    componentProps: Props;
  } & CoreServiceInjectedProps<typeof GAS_ACCOUNT_SERVICE_DEPENDENCIES>;

  const Provider: React.FC<InjectedProps> = ({
    coreServices,
    componentProps,
  }) => (
    <GasAccountServicesContext.Provider value={coreServices}>
      <Component {...componentProps} />
    </GasAccountServicesContext.Provider>
  );

  Provider.displayName = `GasAccountServicesProvider(${
    Component.displayName || Component.name || 'Component'
  })`;

  const PreparedProvider = withPreparedCoreServices(
    GAS_ACCOUNT_SERVICE_DEPENDENCIES,
    Provider,
    {
      prepare: prepareGasAccountState,
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
  Wrapped.displayName = `withGasAccountService(${
    Component.displayName || Component.name || 'Component'
  })`;
  return Wrapped;
}

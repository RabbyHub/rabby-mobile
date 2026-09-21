import React from 'react';

import {
  serviceDependency,
  withCoreServices,
} from '@/core/serviceApi/serviceDependencies';
import type {
  CoreServiceInjectedProps,
  ResolvedCoreServices,
  WithCoreServicesOptions,
} from '@/core/serviceApi/serviceDependencies';

export const CUSTOM_TESTNET_SERVICE_DEPENDENCIES = [
  serviceDependency('customTestnetService'),
] as const;

export type CustomTestnetServices = ResolvedCoreServices<
  typeof CUSTOM_TESTNET_SERVICE_DEPENDENCIES
>;

const CustomTestnetServicesContext = React.createContext<
  CustomTestnetServices | undefined
>(undefined);

export function useCustomTestnetService() {
  const services = React.useContext(CustomTestnetServicesContext);
  if (!services) {
    throw new Error(
      'useCustomTestnetService must be used inside a custom testnet service boundary',
    );
  }
  return services.customTestnetService;
}

export function withCustomTestnetService<Props extends object>(
  Component: React.ComponentType<Props>,
  options: WithCoreServicesOptions<Props> = {},
): React.ComponentType<Props> {
  type InjectedProps = {
    componentProps: Props;
  } & CoreServiceInjectedProps<typeof CUSTOM_TESTNET_SERVICE_DEPENDENCIES>;

  const Provider: React.FC<InjectedProps> = ({
    coreServices,
    componentProps,
  }) => (
    <CustomTestnetServicesContext.Provider value={coreServices}>
      <Component {...componentProps} />
    </CustomTestnetServicesContext.Provider>
  );

  Provider.displayName = `CustomTestnetServicesProvider(${
    Component.displayName || Component.name || 'Component'
  })`;

  const ServiceProvider = withCoreServices(
    CUSTOM_TESTNET_SERVICE_DEPENDENCIES,
    Provider,
    {
      fallback: props =>
        typeof options.fallback === 'function'
          ? options.fallback(props.componentProps)
          : options.fallback,
      renderError: options.renderError,
    },
  );

  const Wrapped: React.FC<Props> = props => (
    <ServiceProvider componentProps={props} />
  );
  Wrapped.displayName = `withCustomTestnetService(${
    Component.displayName || Component.name || 'Component'
  })`;
  return Wrapped;
}

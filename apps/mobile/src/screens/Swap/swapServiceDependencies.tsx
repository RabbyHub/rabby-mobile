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
import { prepareSwapRecentTokensFromService } from './hooks/recent';
import { prepareSwapSettingsFromService } from './hooks/settings';
import { prepareSwapSlippageFromService } from './hooks/slippage';

export const SWAP_SERVICE_DEPENDENCIES = [
  serviceDependency('swapService'),
] as const;

export type SwapServices = ResolvedCoreServices<
  typeof SWAP_SERVICE_DEPENDENCIES
>;

const SwapServicesContext = React.createContext<SwapServices | undefined>(
  undefined,
);

export function useSwapService() {
  const services = React.useContext(SwapServicesContext);
  if (!services) {
    throw new Error(
      'useSwapService must be used inside a swap service boundary',
    );
  }
  return services.swapService;
}

function prepareSwapState(services: SwapServices) {
  prepareSwapSettingsFromService(services.swapService);
  prepareSwapSlippageFromService(services.swapService);
  prepareSwapRecentTokensFromService(services.swapService);
}

export function withSwapService<Props extends object>(
  Component: React.ComponentType<Props>,
  options: WithCoreServicesOptions<Props> = {},
): React.ComponentType<Props> {
  type InjectedProps = {
    componentProps: Props;
  } & CoreServiceInjectedProps<typeof SWAP_SERVICE_DEPENDENCIES>;

  const Provider: React.FC<InjectedProps> = ({
    coreServices,
    componentProps,
  }) => (
    <SwapServicesContext.Provider value={coreServices}>
      <Component {...componentProps} />
    </SwapServicesContext.Provider>
  );

  Provider.displayName = `SwapServicesProvider(${
    Component.displayName || Component.name || 'Component'
  })`;

  const PreparedProvider = withPreparedCoreServices(
    SWAP_SERVICE_DEPENDENCIES,
    Provider,
    {
      prepare: prepareSwapState,
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
  Wrapped.displayName = `withSwapService(${
    Component.displayName || Component.name || 'Component'
  })`;
  return Wrapped;
}

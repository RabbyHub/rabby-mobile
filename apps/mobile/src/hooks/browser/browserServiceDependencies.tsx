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
import { prepareDappStoreFromService } from '@/hooks/useDapps';
import { prepareBrowserTabsFromServices } from './useBrowser';
import { prepareBrowserBookmarkStoreFromService } from './useBrowserBookmark';
import { prepareBrowserHistoryStoreFromService } from './useBrowserHistory';

export const BROWSER_DAPP_SERVICE_DEPENDENCIES = [
  serviceDependency('browserService'),
  serviceDependency('dappService'),
] as const;

export type BrowserDappServices = ResolvedCoreServices<
  typeof BROWSER_DAPP_SERVICE_DEPENDENCIES
>;

const BrowserDappServicesContext = React.createContext<
  BrowserDappServices | undefined
>(undefined);

export function useBrowserDappServices() {
  const services = React.useContext(BrowserDappServicesContext);
  if (!services) {
    throw new Error(
      'useBrowserDappServices must be used inside a browser/dapp service boundary',
    );
  }
  return services;
}

function prepareBrowserDappState(services: BrowserDappServices) {
  prepareDappStoreFromService(services.dappService);
  prepareBrowserTabsFromServices(services.browserService, services.dappService);
  prepareBrowserBookmarkStoreFromService(services.browserService);
  prepareBrowserHistoryStoreFromService(services.browserService);
}

export function withBrowserDappServices<Props extends object>(
  Component: React.ComponentType<Props>,
  options: WithCoreServicesOptions<Props> = {},
): React.ComponentType<Props> {
  type InjectedProps = {
    componentProps: Props;
  } & CoreServiceInjectedProps<typeof BROWSER_DAPP_SERVICE_DEPENDENCIES>;

  const Provider: React.FC<InjectedProps> = ({
    coreServices,
    componentProps,
  }) => (
    <BrowserDappServicesContext.Provider value={coreServices}>
      <Component {...componentProps} />
    </BrowserDappServicesContext.Provider>
  );

  Provider.displayName = `BrowserDappServicesProvider(${
    Component.displayName || Component.name || 'Component'
  })`;

  const PreparedProvider = withPreparedCoreServices(
    BROWSER_DAPP_SERVICE_DEPENDENCIES,
    Provider,
    {
      prepare: prepareBrowserDappState,
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
  Wrapped.displayName = `withBrowserDappServices(${
    Component.displayName || Component.name || 'Component'
  })`;
  return Wrapped;
}

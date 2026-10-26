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

export const DAPP_ACCOUNT_SWITCHER_SERVICE_DEPENDENCIES = [
  serviceDependency('dappService'),
] as const;

export type DappAccountSwitcherServices = ResolvedCoreServices<
  typeof DAPP_ACCOUNT_SWITCHER_SERVICE_DEPENDENCIES
>;

export type DappAccountSwitcherServiceInjectedProps = CoreServiceInjectedProps<
  typeof DAPP_ACCOUNT_SWITCHER_SERVICE_DEPENDENCIES
>;

export function withDappAccountSwitcherServices<
  Props extends DappAccountSwitcherServiceInjectedProps,
>(
  Component: React.ComponentType<Props>,
  options: WithCoreServicesOptions<
    Omit<Props, keyof DappAccountSwitcherServiceInjectedProps>
  > = {},
) {
  return withCoreServices(
    DAPP_ACCOUNT_SWITCHER_SERVICE_DEPENDENCIES,
    Component,
    options,
  );
}

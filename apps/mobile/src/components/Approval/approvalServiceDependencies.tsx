import React from 'react';

import {
  serviceDependency,
  withCoreServices,
  withPreparedCoreServices,
} from '@/core/serviceApi/serviceDependencies';
import type {
  CoreServiceDependency,
  CoreServiceInjectedProps,
  ResolvedCoreServices,
  WithCoreServicesOptions,
} from '@/core/serviceApi/serviceDependencies';
import type { CoreServiceRegistry } from '@/core/services/serviceRegistry';

type ApprovalServiceDependencies = readonly CoreServiceDependency[];
type ApprovalServiceContextValue = Partial<CoreServiceRegistry>;

const ApprovalServiceContext =
  React.createContext<ApprovalServiceContextValue | null>(null);

export const APPROVAL_REQUEST_SERVICE_DEPENDENCIES = [
  serviceDependency('notificationService'),
] as const;

export const APPROVAL_CONNECT_SERVICE_DEPENDENCIES = [
  serviceDependency('dappService'),
] as const;

export const APPROVAL_DAPP_SERVICE_DEPENDENCIES = [
  serviceDependency('dappService'),
] as const;

export const APPROVAL_WAITING_SERVICE_DEPENDENCIES = [
  serviceDependency('notificationService'),
  serviceDependency('transactionHistoryService'),
] as const;

export const APPROVAL_SIGN_TYPED_DATA_SERVICE_DEPENDENCIES = [
  serviceDependency('dappService'),
  serviceDependency('transactionHistoryService'),
  serviceDependency('whitelistService'),
] as const;

export const APPROVAL_SIGN_TX_SERVICE_DEPENDENCIES = [
  serviceDependency('customRPCService'),
  serviceDependency('dappService'),
  serviceDependency('gasAccountService'),
  serviceDependency('transactionHistoryService'),
  serviceDependency('whitelistService'),
] as const;

export type ApprovalResolvedServices<
  Dependencies extends ApprovalServiceDependencies,
> = ResolvedCoreServices<Dependencies>;

export function useApprovalService<Name extends keyof CoreServiceRegistry>(
  name: Name,
): CoreServiceRegistry[Name] {
  const services = React.useContext(ApprovalServiceContext);
  const service = services?.[name];
  if (!service) {
    throw new Error(
      `Approval service "${name}" was used outside its typed boundary`,
    );
  }
  return service;
}

export function withApprovalServices<
  const Dependencies extends ApprovalServiceDependencies,
  Props extends object,
>(
  dependencies: Dependencies,
  Component: React.ComponentType<Props>,
  options: WithCoreServicesOptions<Props> & {
    prepare?: (
      services: ResolvedCoreServices<Dependencies>,
    ) => void | Promise<void>;
  } = {},
): React.FC<Props> {
  type InjectedProps = Props & CoreServiceInjectedProps<Dependencies>;

  const ApprovalServiceProvider: React.FC<InjectedProps> = props => {
    const parentServices = React.useContext(ApprovalServiceContext);
    const { coreServices, ...externalProps } = props;
    const services = React.useMemo(
      () => ({ ...parentServices, ...coreServices }),
      [coreServices, parentServices],
    );

    return (
      <ApprovalServiceContext.Provider value={services}>
        <Component {...(externalProps as Props)} />
      </ApprovalServiceContext.Provider>
    );
  };

  ApprovalServiceProvider.displayName = `ApprovalServiceProvider(${
    Component.displayName || Component.name || 'Component'
  })`;

  const externalOptions = {
    fallback: options.fallback,
    renderError: options.renderError,
  } as WithCoreServicesOptions<
    Omit<InjectedProps, keyof CoreServiceInjectedProps<Dependencies>>
  >;

  if (options.prepare) {
    return withPreparedCoreServices(dependencies, ApprovalServiceProvider, {
      ...externalOptions,
      prepare: options.prepare,
    }) as React.FC<Props>;
  }

  return withCoreServices(
    dependencies,
    ApprovalServiceProvider,
    externalOptions,
  ) as React.FC<Props>;
}

import React from 'react';
import {
  serviceDependency,
  useCoreServiceDependencies,
  withCoreServices,
} from './serviceDependencies';
import type {
  CoreServiceInjectedProps,
  WithCoreServicesOptions,
} from './serviceDependencies';

export const TRANSACTION_HISTORY_DEPENDENCIES = [
  serviceDependency('transactionHistoryService'),
] as const;

/**
 * Activates transaction history on demand and lets reactive snapshot consumers
 * sample again after the deferred service becomes available.
 */
export function useTransactionHistoryServiceReady() {
  const state = useCoreServiceDependencies(TRANSACTION_HISTORY_DEPENDENCIES);
  return state.status === 'ready';
}

export function withTransactionHistoryService<Props extends object>(
  Component: React.ComponentType<Props>,
  options: WithCoreServicesOptions<Props> = {},
): React.ComponentType<Props> {
  type InjectedProps = {
    componentProps: Props;
  } & CoreServiceInjectedProps<typeof TRANSACTION_HISTORY_DEPENDENCIES>;

  const Ready: React.FC<InjectedProps> = ({ componentProps }) =>
    React.createElement(Component, componentProps);
  Ready.displayName = `TransactionHistoryServiceProvider(${
    Component.displayName || Component.name || 'Component'
  })`;

  const ServiceBoundary = withCoreServices(
    TRANSACTION_HISTORY_DEPENDENCIES,
    Ready,
    {
      fallback: props =>
        typeof options.fallback === 'function'
          ? options.fallback(props.componentProps)
          : options.fallback,
      renderError: options.renderError,
    },
  );

  const Wrapped: React.FC<Props> = props =>
    React.createElement(ServiceBoundary, { componentProps: props });
  Wrapped.displayName = `withTransactionHistoryService(${
    Component.displayName || Component.name || 'Component'
  })`;
  return Wrapped;
}

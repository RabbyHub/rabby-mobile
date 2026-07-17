import React from 'react';
import {
  ensureCoreService,
  getRegisteredService,
} from '@/core/services/serviceRegistry';
import type {
  CoreServiceName,
  CoreServiceRegistry,
} from '@/core/services/serviceRegistry';

export type CoreServiceReadiness<Name extends CoreServiceName> =
  Name extends 'keyringService' ? 'loaded' | 'runtimeReady' : 'loaded';

export type CoreServiceDependency<
  Name extends CoreServiceName = CoreServiceName,
> = Readonly<{
  name: Name;
  readiness?: CoreServiceReadiness<Name>;
  label?: string;
}>;

type CoreServiceDependencyList = readonly CoreServiceDependency[];

export type ResolvedCoreServices<
  Dependencies extends CoreServiceDependencyList,
> = Pick<CoreServiceRegistry, Dependencies[number]['name']>;

export type CoreServiceInjectedProps<
  Dependencies extends CoreServiceDependencyList,
> = {
  coreServices: ResolvedCoreServices<Dependencies>;
};

export type CoreServiceDependencyState<
  Dependencies extends CoreServiceDependencyList,
> =
  | {
      status: 'loading';
      services?: undefined;
      error?: undefined;
    }
  | {
      status: 'ready';
      services: ResolvedCoreServices<Dependencies>;
      error?: undefined;
    }
  | {
      status: 'error';
      services?: undefined;
      error: Error;
    };

export class CoreServiceDependencyError extends Error {
  constructor(
    message: string,
    readonly serviceName: CoreServiceName,
    readonly readiness: string,
  ) {
    super(message);
    this.name = 'CoreServiceDependencyError';
  }
}

export function serviceDependency<Name extends CoreServiceName>(
  name: Name,
  options: Omit<CoreServiceDependency<Name>, 'name'> = {},
): CoreServiceDependency<Name> {
  return {
    name,
    ...options,
  };
}

function getDependencyKey(dependencies: CoreServiceDependencyList) {
  return dependencies
    .map(dependency => {
      return [
        dependency.name,
        dependency.readiness || 'loaded',
        dependency.label || '',
      ].join(':');
    })
    .join('|');
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

async function ensureDependencyRuntimeReady<Name extends CoreServiceName>(
  dependency: CoreServiceDependency<Name>,
  service: CoreServiceRegistry[Name],
) {
  if (dependency.readiness !== 'runtimeReady') {
    return;
  }

  if (dependency.name !== 'keyringService') {
    throw new CoreServiceDependencyError(
      `Unsupported runtime readiness for core service "${dependency.name}"`,
      dependency.name,
      dependency.readiness,
    );
  }

  const keyringService = service as CoreServiceRegistry['keyringService'];
  if (!keyringService.isUnlocked()) {
    throw new CoreServiceDependencyError(
      'keyringService runtime readiness requires an unlocked wallet',
      dependency.name,
      dependency.readiness,
    );
  }

  if (!keyringService.isKeyringRuntimeReady()) {
    await keyringService.ensureKeyringRuntimeReady(
      dependency.label || 'core service dependency',
    );
  }

  if (!keyringService.isKeyringRuntimeReady()) {
    throw new CoreServiceDependencyError(
      'keyringService did not reach runtime readiness',
      dependency.name,
      dependency.readiness,
    );
  }
}

async function resolveCoreServiceDependency<Name extends CoreServiceName>(
  dependency: CoreServiceDependency<Name>,
) {
  await ensureCoreService(dependency.name);

  const service = getRegisteredService(dependency.name);
  if (!service) {
    throw new CoreServiceDependencyError(
      `Core service "${dependency.name}" finished loading without registration`,
      dependency.name,
      dependency.readiness || 'loaded',
    );
  }

  await ensureDependencyRuntimeReady(dependency, service);
  return service;
}

export async function resolveCoreServices<
  const Dependencies extends CoreServiceDependencyList,
>(dependencies: Dependencies): Promise<ResolvedCoreServices<Dependencies>> {
  const names = new Set<CoreServiceName>();
  dependencies.forEach(dependency => {
    if (names.has(dependency.name)) {
      throw new CoreServiceDependencyError(
        `Duplicate core service dependency \"${dependency.name}\"`,
        dependency.name,
        dependency.readiness || 'loaded',
      );
    }
    names.add(dependency.name);
  });

  const entries = await Promise.all(
    dependencies.map(async dependency => {
      const service = await resolveCoreServiceDependency(dependency);
      return [dependency.name, service] as const;
    }),
  );

  return Object.fromEntries(entries) as ResolvedCoreServices<Dependencies>;
}

/**
 * Crosses one explicit async boundary, then gives the runner concrete service
 * instances. Keep synchronous business work inside the runner. For a
 * long-lived synchronous controller, return the controller from this runner
 * and only register/use it after this Promise resolves.
 */
export async function runWithCoreServices<
  const Dependencies extends CoreServiceDependencyList,
  Result,
>(
  dependencies: Dependencies,
  runner: (
    services: ResolvedCoreServices<Dependencies>,
  ) => Result | Promise<Result>,
): Promise<Awaited<Result>> {
  const services = await resolveCoreServices(dependencies);
  return await runner(services);
}

export function useCoreServiceDependencies<
  const Dependencies extends CoreServiceDependencyList,
>(dependencies: Dependencies): CoreServiceDependencyState<Dependencies> {
  const dependencyKey = getDependencyKey(dependencies);
  const dependenciesRef = React.useRef(dependencies);
  dependenciesRef.current = dependencies;
  const [state, setState] = React.useState<
    CoreServiceDependencyState<Dependencies>
  >({ status: 'loading' });

  React.useEffect(() => {
    let disposed = false;
    setState({ status: 'loading' });

    void resolveCoreServices(dependenciesRef.current).then(
      services => {
        if (!disposed) {
          setState({ status: 'ready', services });
        }
      },
      error => {
        if (!disposed) {
          setState({ status: 'error', error: toError(error) });
        }
      },
    );

    return () => {
      disposed = true;
    };
  }, [dependencyKey]);

  return state;
}

export type CoreServiceBoundaryProps<
  Dependencies extends CoreServiceDependencyList,
> = {
  dependencies: Dependencies;
  children: (services: ResolvedCoreServices<Dependencies>) => React.ReactNode;
  fallback?: React.ReactNode;
  renderError?: (error: Error) => React.ReactNode;
};

export function CoreServiceBoundary<
  const Dependencies extends CoreServiceDependencyList,
>({
  dependencies,
  children,
  fallback = null,
  renderError,
}: CoreServiceBoundaryProps<Dependencies>) {
  const state = useCoreServiceDependencies(dependencies);

  if (state.status === 'loading') {
    return fallback;
  }

  if (state.status === 'error') {
    if (renderError) {
      return renderError(state.error);
    }
    throw state.error;
  }

  return children(state.services);
}

export type WithCoreServicesOptions<ExternalProps = never> = {
  fallback?:
    | React.ReactNode
    | ((props: Readonly<ExternalProps>) => React.ReactNode);
  renderError?: (error: Error) => React.ReactNode;
};

export type WithPreparedCoreServicesOptions<
  Dependencies extends CoreServiceDependencyList,
  ExternalProps = never,
> = WithCoreServicesOptions<ExternalProps> & {
  prepare: (
    services: ResolvedCoreServices<Dependencies>,
  ) => void | Promise<void>;
};

/**
 * Injects already-loaded core services into a component. The wrapper only
 * exposes the component's business props; `coreServices` stays internal.
 *
 * Ref forwarding is intentionally not implicit. Use CoreServiceBoundary around
 * ref-bearing components so their ref contract remains explicit.
 */
export function withCoreServices<
  const Dependencies extends CoreServiceDependencyList,
  Props extends CoreServiceInjectedProps<Dependencies>,
>(
  dependencies: Dependencies,
  Component: React.ComponentType<Props>,
  options: WithCoreServicesOptions<
    Omit<Props, keyof CoreServiceInjectedProps<Dependencies>>
  > = {},
): React.ComponentType<
  Omit<Props, keyof CoreServiceInjectedProps<Dependencies>>
> {
  type ExternalProps = Omit<
    Props,
    keyof CoreServiceInjectedProps<Dependencies>
  >;

  const Wrapped: React.FC<ExternalProps> = props => {
    const fallback =
      typeof options.fallback === 'function'
        ? options.fallback(props)
        : options.fallback;

    return (
      <CoreServiceBoundary
        dependencies={dependencies}
        fallback={fallback}
        renderError={options.renderError}>
        {coreServices =>
          React.createElement(Component, {
            ...props,
            coreServices,
          } as Props)
        }
      </CoreServiceBoundary>
    );
  };

  Wrapped.displayName = `withCoreServices(${
    Component.displayName || Component.name || 'Component'
  })`;
  return Wrapped;
}

/**
 * Loads concrete services, prepares feature-local synchronous state, and only
 * then renders the business component. Use this when the old singleton path
 * exposed persisted state on the component's first meaningful render.
 */
export function withPreparedCoreServices<
  const Dependencies extends CoreServiceDependencyList,
  Props extends CoreServiceInjectedProps<Dependencies>,
>(
  dependencies: Dependencies,
  Component: React.ComponentType<Props>,
  options: WithPreparedCoreServicesOptions<
    Dependencies,
    Omit<Props, keyof CoreServiceInjectedProps<Dependencies>>
  >,
): React.ComponentType<
  Omit<Props, keyof CoreServiceInjectedProps<Dependencies>>
> {
  type ExternalProps = Omit<
    Props,
    keyof CoreServiceInjectedProps<Dependencies>
  >;

  const Prepared: React.FC<Props> = props => {
    const { coreServices } = props;
    const [state, setState] = React.useState<
      | { status: 'preparing'; services: typeof coreServices }
      | { status: 'ready'; services: typeof coreServices }
      | { status: 'error'; services: typeof coreServices; error: Error }
    >({ status: 'preparing', services: coreServices });

    React.useLayoutEffect(() => {
      let disposed = false;
      setState({ status: 'preparing', services: coreServices });

      const markReady = () => {
        if (!disposed) {
          setState({ status: 'ready', services: coreServices });
        }
      };
      const markError = (error: unknown) => {
        if (!disposed) {
          setState({
            status: 'error',
            services: coreServices,
            error: toError(error),
          });
        }
      };

      try {
        const preparation = options.prepare(coreServices);
        if (preparation) {
          void preparation.then(markReady, markError);
        } else {
          // A synchronous persisted-state preparation is flushed from the
          // layout effect before the fallback can become visible.
          markReady();
        }
      } catch (error) {
        markError(error);
      }

      return () => {
        disposed = true;
      };
    }, [coreServices]);

    const externalProps = props as ExternalProps;
    const fallback =
      typeof options.fallback === 'function'
        ? options.fallback(externalProps)
        : options.fallback;

    if (state.services !== coreServices || state.status === 'preparing') {
      return fallback;
    }

    if (state.status === 'error') {
      if (options.renderError) {
        return options.renderError(state.error);
      }
      throw state.error;
    }

    return React.createElement(Component, props);
  };

  Prepared.displayName = `prepareCoreServices(${
    Component.displayName || Component.name || 'Component'
  })`;

  return withCoreServices(dependencies, Prepared, {
    fallback: options.fallback,
    renderError: options.renderError,
  });
}

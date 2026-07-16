import React from 'react';
import {
  isCoreServiceLoaded,
  isCoreServiceRegistered,
  registerCoreServiceLoader,
  registerService,
} from '@/core/services/serviceRegistry';
import type { CoreServiceRegistry } from '@/core/services/serviceRegistry';
import {
  resolveCoreServices,
  runWithCoreServices,
  serviceDependency,
  type CoreServiceInjectedProps,
  withCoreServices,
} from './serviceDependencies';

const SWAP_DEPENDENCIES = [serviceDependency('swapService')] as const;

type TypedComponentProps = {
  title: string;
} & CoreServiceInjectedProps<typeof SWAP_DEPENDENCIES>;

const TypedComponent: React.FC<TypedComponentProps> = () => null;
const TypedWrappedComponent = withCoreServices(
  SWAP_DEPENDENCIES,
  TypedComponent,
);

const typedExternalProps: React.ComponentProps<typeof TypedWrappedComponent> = {
  title: 'Swap',
};
void typedExternalProps;

// @ts-expect-error coreServices is internal to the HOC and cannot be supplied by callers.
const invalidTypedExternalProps: React.ComponentProps<
  typeof TypedWrappedComponent
> = { title: 'Swap', coreServices: {} };
void invalidTypedExternalProps;

describe('core service dependencies', () => {
  it('injects an actual service instance and preserves synchronous method types inside the runner', async () => {
    let slippage = '0.5';
    const service = {
      getSlippage: () => slippage,
      setSlippage: (next: string) => {
        slippage = next;
      },
    } as CoreServiceRegistry['swapService'];
    let unregisterService: (() => void) | undefined;
    const unregisterLoader = registerCoreServiceLoader(
      'swapService',
      async () => {
        unregisterService = registerService('swapService', service);
      },
    );

    const handler = await runWithCoreServices(SWAP_DEPENDENCIES, services => ({
      setAndReadSlippage(next: string): string {
        services.swapService.setSlippage(next);
        return services.swapService.getSlippage();
      },
    }));

    // This happens after the async factory resolves. It remains a direct,
    // synchronous write-then-read sequence over the injected instance.
    const result: string = handler.setAndReadSlippage('0.7');
    expect(result).toBe('0.7');

    unregisterService?.();
    unregisterLoader();
  });

  it('does not resolve injected services until their loader has completed', async () => {
    const service = {} as CoreServiceRegistry['dappService'];
    let signalLoaderStarted: (() => void) | undefined;
    let releaseLoader: (() => void) | undefined;
    let unregisterService: (() => void) | undefined;
    const loaderStarted = new Promise<void>(resolve => {
      signalLoaderStarted = resolve;
    });
    const unregisterLoader = registerCoreServiceLoader(
      'dappService',
      async () => {
        unregisterService = registerService('dappService', service);
        signalLoaderStarted?.();
        await new Promise<void>(resolve => {
          releaseLoader = resolve;
        });
      },
    );
    const readiness = resolveCoreServices([
      serviceDependency('dappService'),
    ] as const);
    let resolved = false;
    void readiness.then(() => {
      resolved = true;
    });

    try {
      await loaderStarted;
      expect(isCoreServiceRegistered('dappService')).toBe(true);
      expect(isCoreServiceLoaded('dappService')).toBe(false);
      expect(resolved).toBe(false);

      releaseLoader?.();
      const services = await readiness;

      expect(services.dappService).toBe(service);
      expect(isCoreServiceLoaded('dappService')).toBe(true);
    } finally {
      unregisterService?.();
      unregisterLoader();
    }
  });

  it('enforces keyring runtime readiness only when a dependency requests it', async () => {
    let runtimeReady = false;
    const ensureKeyringRuntimeReady = jest.fn(async () => {
      runtimeReady = true;
    });
    const keyringService = {
      isUnlocked: () => true,
      isKeyringRuntimeReady: () => runtimeReady,
      ensureKeyringRuntimeReady,
    } as CoreServiceRegistry['keyringService'];
    let unregisterService: (() => void) | undefined;
    const unregisterLoader = registerCoreServiceLoader(
      'keyringService',
      async () => {
        unregisterService = registerService('keyringService', keyringService);
      },
    );

    await runWithCoreServices(
      [
        serviceDependency('keyringService', {
          readiness: 'runtimeReady',
          label: 'service dependency test',
        }),
      ] as const,
      services => {
        expect(services.keyringService.isKeyringRuntimeReady()).toBe(true);
      },
    );

    expect(ensureKeyringRuntimeReady).toHaveBeenCalledWith(
      'service dependency test',
    );

    unregisterService?.();
    unregisterLoader();
  });
});

import { IS_ROZENITE_ENABLED } from '@/constant/env';
import { ORM_TABLE_NAMES } from '@/databases/constant';
import type { IAppChainItem } from './appchain';
import { ResourceBaseStore } from './_resourceBase';
import type { ResourceLocalTarget } from './_resourceFlowDebug';
import { traceStartupDiagnostic } from '@/core/utils/startupDiagnostics';

type AppChainResourceDetail = {
  trigger: 'initStore' | 'batchGetAppChains' | 'getAppChains';
  force?: boolean;
  reason?: string;
  count?: number;
  chainId?: string;
};

function pickAppChainPersistDiagnosticDetail(detail: AppChainResourceDetail) {
  return {
    trigger: detail.trigger,
    force: detail.force,
    reason: detail.reason,
    count: detail.count,
    chainId: detail.chainId,
  };
}

const APPCHAIN_RESOURCE_KEY_SEPARATOR = '::';

const createAppChainLocalTargets = (
  ownerAddr: string,
  chainId: string,
): ResourceLocalTarget[] => [
  {
    kind: 'sqlite',
    table: ORM_TABLE_NAMES.cache_appchain,
    where: {
      owner_addr: ownerAddr.toLowerCase(),
      id: chainId,
    },
  },
];

class AppChainResourceStore extends ResourceBaseStore<IAppChainItem> {
  private readonly enabled = IS_ROZENITE_ENABLED;
  private readonly ownerResourceKeys = new Map<string, Set<string>>();
  private remoteRequestSequence = 0;

  constructor() {
    super('appchain');
  }

  private getOwnerKey(ownerAddr: string) {
    return ownerAddr.toLowerCase();
  }

  private getResourceKey(ownerAddr: string, chainId: string) {
    return [this.getOwnerKey(ownerAddr), chainId].join(
      APPCHAIN_RESOURCE_KEY_SEPARATOR,
    );
  }

  private parseResourceKey(resourceKey: string) {
    const [ownerAddr, ...chainIdParts] = resourceKey.split(
      APPCHAIN_RESOURCE_KEY_SEPARATOR,
    );

    return {
      ownerAddr,
      chainId: chainIdParts.join(APPCHAIN_RESOURCE_KEY_SEPARATOR),
    };
  }

  private createRemoteRequestId(ownerAddr: string) {
    this.remoteRequestSequence += 1;
    return `appchain:${this.getOwnerKey(ownerAddr)}:remote:${
      this.remoteRequestSequence
    }`;
  }

  private getKnownResourceKeys(ownerAddr: string) {
    return Array.from(
      this.ownerResourceKeys.get(this.getOwnerKey(ownerAddr)) || [],
    );
  }

  private replaceOwnerResourceKeys(ownerAddr: string, resourceKeys: string[]) {
    const ownerKey = this.getOwnerKey(ownerAddr);

    if (!resourceKeys.length) {
      this.ownerResourceKeys.delete(ownerKey);
      return;
    }

    this.ownerResourceKeys.set(ownerKey, new Set(resourceKeys));
  }

  private getLifecycleOptionsByResourceKey(
    resourceKey: string,
    detail: AppChainResourceDetail,
    requestId?: string,
  ) {
    const { ownerAddr, chainId } = this.parseResourceKey(resourceKey);

    return {
      requestId,
      detail: {
        ...detail,
        chainId,
      },
      localTargets: createAppChainLocalTargets(ownerAddr, chainId),
    };
  }

  private syncOwnerResources(
    ownerAddr: string,
    appChains: IAppChainItem[],
    detail: AppChainResourceDetail,
    syncItem: (resourceKey: string, appChain: IAppChainItem) => void,
  ) {
    const nextResourceKeys = new Set<string>();

    appChains.forEach(appChain => {
      const resourceKey = this.getResourceKey(ownerAddr, appChain.id);
      nextResourceKeys.add(resourceKey);
      syncItem(resourceKey, appChain);
    });

    this.getKnownResourceKeys(ownerAddr).forEach(resourceKey => {
      if (nextResourceKeys.has(resourceKey)) {
        return;
      }

      this.removeResource(
        resourceKey,
        this.getLifecycleOptionsByResourceKey(resourceKey, {
          ...detail,
          reason: 'removed_from_latest_snapshot',
        }),
      );
    });

    this.replaceOwnerResourceKeys(ownerAddr, Array.from(nextResourceKeys));
  }

  hydrate(
    ownerAddr: string,
    value: IAppChainItem[],
    detail: AppChainResourceDetail,
  ) {
    if (!this.enabled) {
      return;
    }

    this.syncOwnerResources(
      ownerAddr,
      value,
      detail,
      (resourceKey, appChain) => {
        this.applyHydratedValue(
          resourceKey,
          appChain,
          this.getLifecycleOptionsByResourceKey(resourceKey, {
            ...detail,
            count: value.length,
          }),
        );
      },
    );
  }

  markHydrateStartedFor(ownerAddr: string, detail: AppChainResourceDetail) {
    if (!this.enabled) {
      return;
    }

    this.getKnownResourceKeys(ownerAddr).forEach(resourceKey => {
      this.markHydrateStarted(
        resourceKey,
        this.getLifecycleOptionsByResourceKey(resourceKey, detail),
      );
    });
  }

  markHydrateSkippedFor(ownerAddr: string, detail: AppChainResourceDetail) {
    if (!this.enabled) {
      return;
    }

    this.getKnownResourceKeys(ownerAddr).forEach(resourceKey => {
      this.markHydrateSkipped(
        resourceKey,
        this.getLifecycleOptionsByResourceKey(resourceKey, detail),
      );
    });
  }

  startRemoteFetchFor(ownerAddr: string, detail: AppChainResourceDetail) {
    if (!this.enabled) {
      return undefined;
    }

    const requestId = this.createRemoteRequestId(ownerAddr);

    this.getKnownResourceKeys(ownerAddr).forEach(resourceKey => {
      this.markRemoteFetchStartedWithRequestId(
        resourceKey,
        requestId,
        this.getLifecycleOptionsByResourceKey(resourceKey, detail),
      );
    });

    return requestId;
  }

  applyRemoteValueFor(
    ownerAddr: string,
    requestId: string | undefined,
    value: IAppChainItem[],
    detail: AppChainResourceDetail,
  ) {
    if (!this.enabled) {
      return false;
    }

    const effectiveRequestId =
      requestId || this.createRemoteRequestId(ownerAddr);
    let hasApplied = false;

    this.syncOwnerResources(
      ownerAddr,
      value,
      detail,
      (resourceKey, appChain) => {
        hasApplied =
          this.applyRemoteValue(
            resourceKey,
            effectiveRequestId,
            appChain,
            this.getLifecycleOptionsByResourceKey(resourceKey, {
              ...detail,
              count: value.length,
            }),
          ) || hasApplied;
      },
    );

    return hasApplied;
  }

  markRemoteErrorFor(
    ownerAddr: string,
    requestId: string | undefined,
    error: unknown,
    detail: AppChainResourceDetail,
  ) {
    if (!this.enabled) {
      return false;
    }

    const effectiveRequestId =
      requestId || this.createRemoteRequestId(ownerAddr);
    let hasMarked = false;

    this.getKnownResourceKeys(ownerAddr).forEach(resourceKey => {
      hasMarked =
        this.markError(
          resourceKey,
          'remote',
          error,
          this.getLifecycleOptionsByResourceKey(
            resourceKey,
            detail,
            effectiveRequestId,
          ),
        ) || hasMarked;
    });

    return hasMarked;
  }

  persistInBackgroundFor(
    ownerAddr: string,
    persist: () => Promise<void>,
    detail: AppChainResourceDetail,
  ) {
    const startedAt = Date.now();
    traceStartupDiagnostic('resource', 'persist_queued', {
      family: 'appchain',
      ...pickAppChainPersistDiagnosticDetail(detail),
    });
    const persistWithDiag = () => {
      traceStartupDiagnostic('resource', 'persist_start', {
        family: 'appchain',
        queuedMs: Date.now() - startedAt,
        ...pickAppChainPersistDiagnosticDetail(detail),
      });

      let persistResult: Promise<void> | void;
      try {
        persistResult = persist();
      } catch (error) {
        traceStartupDiagnostic('resource', 'persist_end', {
          family: 'appchain',
          status: 'error',
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
          ...pickAppChainPersistDiagnosticDetail(detail),
        });
        throw error;
      }

      return Promise.resolve(persistResult)
        .then(() => {
          traceStartupDiagnostic('resource', 'persist_end', {
            family: 'appchain',
            status: 'success',
            durationMs: Date.now() - startedAt,
            ...pickAppChainPersistDiagnosticDetail(detail),
          });
        })
        .catch(error => {
          traceStartupDiagnostic('resource', 'persist_end', {
            family: 'appchain',
            status: 'error',
            durationMs: Date.now() - startedAt,
            error: error instanceof Error ? error.message : String(error),
            ...pickAppChainPersistDiagnosticDetail(detail),
          });
          throw error;
        });
    };

    if (!this.enabled) {
      return persistWithDiag();
    }

    const resourceKeys = this.getKnownResourceKeys(ownerAddr);

    if (!resourceKeys.length) {
      return persistWithDiag();
    }

    resourceKeys.forEach(resourceKey => {
      this.queuePersist(
        resourceKey,
        this.getLifecycleOptionsByResourceKey(resourceKey, detail),
      );
    });

    return Promise.resolve()
      .then(() => {
        traceStartupDiagnostic('resource', 'persist_start', {
          family: 'appchain',
          queuedMs: Date.now() - startedAt,
          ...pickAppChainPersistDiagnosticDetail(detail),
        });
        resourceKeys.forEach(resourceKey => {
          this.markPersistStarted(
            resourceKey,
            this.getLifecycleOptionsByResourceKey(resourceKey, detail),
          );
        });

        return persist();
      })
      .then(() => {
        resourceKeys.forEach(resourceKey => {
          this.markPersistSucceeded(
            resourceKey,
            this.getLifecycleOptionsByResourceKey(resourceKey, detail),
          );
        });
        traceStartupDiagnostic('resource', 'persist_end', {
          family: 'appchain',
          status: 'success',
          durationMs: Date.now() - startedAt,
          ...pickAppChainPersistDiagnosticDetail(detail),
        });
      })
      .catch(error => {
        console.error(`Failed to persist appchains for ${ownerAddr}:`, error);

        resourceKeys.forEach(resourceKey => {
          this.markError(
            resourceKey,
            'persist',
            error,
            this.getLifecycleOptionsByResourceKey(resourceKey, detail),
          );
        });
        traceStartupDiagnostic('resource', 'persist_end', {
          family: 'appchain',
          status: 'error',
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
          ...pickAppChainPersistDiagnosticDetail(detail),
        });
      });
  }
}

export const appChainResourceStore = new AppChainResourceStore();

export default appChainResourceStore;

import type { CoreServiceName } from '@/core/services/serviceRegistry';
import type { StartupTaskPriority } from '@/core/utils/startupScheduler';

export type CoreServiceLoaderDefinition = Readonly<{
  dependencies: readonly CoreServiceName[];
  priority?: StartupTaskPriority;
}>;

export const CORE_SERVICE_LOADER_MANIFEST: Readonly<
  Record<CoreServiceName, CoreServiceLoaderDefinition>
> = {
  autoConnectService: {
    dependencies: [
      'dappService',
      'keyringService',
      'preferenceService',
      'transactionHistoryService',
    ],
  },
  bridgeService: { dependencies: [] },
  browserHistoryService: { dependencies: [] },
  browserService: { dependencies: [] },
  contactService: { dependencies: [] },
  currencyService: { dependencies: [] },
  customRPCService: { dependencies: [] },
  customTestnetService: { dependencies: [] },
  dappService: { dependencies: ['preferenceService'] },
  gasAccountService: { dependencies: [] },
  hdKeyringService: { dependencies: [] },
  keyringService: { dependencies: [], priority: 'critical' },
  lendingService: { dependencies: [] },
  metamaskModeService: { dependencies: [] },
  notificationService: {
    dependencies: ['preferenceService', 'transactionHistoryService'],
    priority: 'high',
  },
  offlineChainService: { dependencies: [] },
  perpsService: { dependencies: [] },
  preferenceService: { dependencies: [], priority: 'critical' },
  rabbyPointsService: { dependencies: [] },
  securityEngineService: { dependencies: [], priority: 'high' },
  sessionService: { dependencies: ['dappService'] },
  swapService: { dependencies: [] },
  syncChainService: { dependencies: [] },
  transactionBroadcastWatcherService: {
    dependencies: ['transactionHistoryService', 'transactionWatcherService'],
  },
  transactionHistoryService: {
    dependencies: ['preferenceService'],
    priority: 'high',
  },
  transactionWatcherService: {
    dependencies: ['transactionHistoryService'],
  },
  whitelistService: { dependencies: [] },
};

type ServiceLoaderDependencyGraph = Readonly<Record<string, readonly string[]>>;

export function findServiceLoaderDependencyCycle(
  graph: ServiceLoaderDependencyGraph,
) {
  const visited = new Set<string>();
  const activeIndexes = new Map<string, number>();
  const path: string[] = [];

  const visit = (name: string): string[] | null => {
    const activeIndex = activeIndexes.get(name);
    if (activeIndex !== undefined) {
      return [...path.slice(activeIndex), name];
    }

    if (visited.has(name)) {
      return null;
    }

    activeIndexes.set(name, path.length);
    path.push(name);

    for (const dependency of graph[name] || []) {
      const cycle = visit(dependency);
      if (cycle) {
        return cycle;
      }
    }

    path.pop();
    activeIndexes.delete(name);
    visited.add(name);
    return null;
  };

  for (const name of Object.keys(graph)) {
    const cycle = visit(name);
    if (cycle) {
      return cycle;
    }
  }

  return null;
}

export function assertServiceLoaderDependencyGraph(
  graph: ServiceLoaderDependencyGraph,
) {
  const names = new Set(Object.keys(graph));
  for (const [name, dependencies] of Object.entries(graph)) {
    for (const dependency of dependencies) {
      if (!names.has(dependency)) {
        throw new Error(
          `Core service loader "${name}" depends on unknown service "${dependency}"`,
        );
      }
    }
  }

  const cycle = findServiceLoaderDependencyCycle(graph);
  if (cycle) {
    throw new Error(
      `Core service loader dependency cycle: ${cycle.join(' -> ')}`,
    );
  }
}

export function getCoreServiceLoaderDependencyGraph() {
  return Object.fromEntries(
    Object.entries(CORE_SERVICE_LOADER_MANIFEST).map(([name, definition]) => [
      name,
      definition.dependencies,
    ]),
  ) as Record<CoreServiceName, readonly CoreServiceName[]>;
}

import {
  ensureCoreService,
  registerCoreServiceLoader,
  type CoreServiceName,
} from '@/core/services/serviceRegistry';
import { runOnDemandStartupTask } from '@/core/utils/startupScheduler';
import type { StartupTaskOptions } from '@/core/utils/startupScheduler';
import { observeStartupModuleLoad } from '@/startup/runtimeDiagnostics';
import {
  assertServiceLoaderDependencyGraph,
  CORE_SERVICE_LOADER_MANIFEST,
  getCoreServiceLoaderDependencyGraph,
} from './serviceLoaderManifest';

const serviceLoadPromises = new Map<CoreServiceName, Promise<void>>();
let catalogRegistered = false;

function getLoaderTaskOptions(name: CoreServiceName): StartupTaskOptions {
  return {
    label: `service.${name}.load`,
    owner: 'service',
    reason:
      'load a core service implementation after an explicit service API demand',
    stage: 'onDemand',
    priority: CORE_SERVICE_LOADER_MANIFEST[name].priority || 'normal',
    budgetMs: 240,
  };
}

function loadCoreService(name: CoreServiceName) {
  const pending = serviceLoadPromises.get(name);
  if (pending) {
    return pending;
  }

  const loadPromise = Promise.resolve(
    runOnDemandStartupTask(
      () =>
        Promise.all(
          CORE_SERVICE_LOADER_MANIFEST[name].dependencies.map(dependency =>
            ensureCoreService(dependency),
          ),
        ).then(() =>
          observeStartupModuleLoad(
            {
              name: 'core/services/featureLoaders',
              group: 'service',
              taskStage: 'onDemand',
              reason: `service:${name}`,
            },
            () => import('@/core/services/featureLoaders'),
          ).then(module => module.loadFeatureCoreService(name)),
        ),
      getLoaderTaskOptions(name),
    ),
  )
    .then(() => {
      serviceLoadPromises.delete(name);
    })
    .catch(error => {
      serviceLoadPromises.delete(name);
      throw error;
    });

  serviceLoadPromises.set(name, loadPromise);
  return loadPromise;
}

export function registerCoreServiceLoaderCatalog() {
  if (catalogRegistered) {
    return;
  }
  assertServiceLoaderDependencyGraph(getCoreServiceLoaderDependencyGraph());
  catalogRegistered = true;

  (Object.keys(CORE_SERVICE_LOADER_MANIFEST) as CoreServiceName[]).forEach(
    name => {
      registerCoreServiceLoader(name, () => loadCoreService(name));
    },
  );
}

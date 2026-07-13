import { startSubscribeLangChange } from '@/hooks/lang';
import { runStartupTask } from '@/core/utils/store';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
import { ensureSyncChainServiceReady } from '@/core/serviceApi/syncChain';
import { ensureServiceApiReady } from '@/core/serviceApi/createDeferredServiceApi';

import { registerStartupPhaseTask } from './phaseRegistry';

registerStartupPhaseTask('launch', {
  id: STARTUP_TASKS.bootstrapI18nReady.label,
  run: () => {
    runStartupTask(
      () => startSubscribeLangChange(),
      STARTUP_TASKS.bootstrapI18nReady,
    );
  },
});

registerStartupPhaseTask('launch', {
  id: STARTUP_TASKS.homePreSplashLocalStateWarmup.label,
  run: () => {
    runStartupTask(async () => {
      const { warmHomePreSplashLocalState } = await import(
        '@/setup-home-pre-splash-state'
      );
      warmHomePreSplashLocalState();
    }, STARTUP_TASKS.homePreSplashLocalStateWarmup);
  },
});

registerStartupPhaseTask('launch', {
  id: STARTUP_TASKS.computationWorkerPrewarm.label,
  run: () => {
    runStartupTask(async () => {
      const { requestComputationThreadStart } = await import('@/perfs/thread');
      requestComputationThreadStart('startup_prewarm');
    }, STARTUP_TASKS.computationWorkerPrewarm);
  },
});

registerStartupPhaseTask('launch', {
  id: STARTUP_TASKS.transactionWatchersStart.label,
  run: () => {
    runStartupTask(
      () =>
        Promise.all([
          ensureServiceApiReady('transactionWatcherService'),
          ensureServiceApiReady('transactionBroadcastWatcherService'),
        ]),
      STARTUP_TASKS.transactionWatchersStart,
    );
  },
});

registerStartupPhaseTask('launch', {
  id: STARTUP_TASKS.syncChainMetadataWarmup.label,
  run: () => {
    runStartupTask(
      () => ensureSyncChainServiceReady(),
      STARTUP_TASKS.syncChainMetadataWarmup,
    );
  },
});

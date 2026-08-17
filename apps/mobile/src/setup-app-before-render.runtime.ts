import { runStartupTask } from './core/utils/startupScheduler';
import { STARTUP_TASKS } from './core/utils/startupTaskManifest';
import { traceAndroidInstant } from './core/utils/androidTrace';

const deferredStartupTasksRegisteredRef = {
  current: false,
};

export function registerSetupAppBeforeRenderDeferredTasks(reason = 'unknown') {
  if (deferredStartupTasksRegisteredRef.current) {
    traceAndroidInstant('startup.setup_before_render.register_skipped', {
      reason,
    });
    return;
  }

  deferredStartupTasksRegisteredRef.current = true;
  traceAndroidInstant('startup.setup_before_render.register', {
    reason,
  });

  runStartupTask(async () => {
    const { startSetupRuntimeCoreLifecycle } = await import(
      './startup/deferredTasks/setupRuntimeCoreLifecycle'
    );
    startSetupRuntimeCoreLifecycle();
  }, STARTUP_TASKS.setupRuntimeCoreLifecycle);

  runStartupTask(async () => {
    const { startSetupRuntimeRemoteWarmups } = await import(
      './startup/deferredTasks/setupRuntimeRemoteWarmups'
    );
    startSetupRuntimeRemoteWarmups();
  }, STARTUP_TASKS.setupRuntimeRemoteWarmups);

  runStartupTask(async () => {
    const { startSetupRuntimeHardwareSubscriptions } = await import(
      './startup/deferredTasks/setupRuntimeHardwareSubscriptions'
    );
    startSetupRuntimeHardwareSubscriptions();
  }, STARTUP_TASKS.setupRuntimeHardwareSubscriptions);

  runStartupTask(async () => {
    const { storeApiGasAccount } = await import(
      './screens/GasAccount/hooks/atom'
    );
    await storeApiGasAccount.fetchGasAccountInfo();
  }, STARTUP_TASKS.setupGasAccountInfoFetch);

  runStartupTask(async () => {
    const { startSetupRuntimePerpsAppStateSubscription } = await import(
      './startup/deferredTasks/setupRuntimePerpsAppStateSubscription'
    );
    startSetupRuntimePerpsAppStateSubscription();
  }, STARTUP_TASKS.setupRuntimePerpsAppStateSubscription);

  runStartupTask(async () => {
    const { startSetupRuntimeSecuritySubscriptions } = await import(
      './startup/deferredTasks/setupRuntimeSecuritySubscriptions'
    );
    startSetupRuntimeSecuritySubscriptions();
  }, STARTUP_TASKS.setupRuntimeSecuritySubscriptions);

  runStartupTask(async () => {
    const { showDeviceSecurityRiskWarningIfNeeded } = await import(
      './core/utils/deviceSecurityRisk'
    );
    await showDeviceSecurityRiskWarningIfNeeded();
  }, STARTUP_TASKS.deviceSecurityRiskWarning);

  runStartupTask(async () => {
    const { startSetupRuntimeNotificationBootstrap } = await import(
      './startup/deferredTasks/setupRuntimeNotificationBootstrap'
    );
    startSetupRuntimeNotificationBootstrap();
  }, STARTUP_TASKS.setupRuntimeNotificationBootstrap);

  runStartupTask(async () => {
    const { startSetupRuntimeUnlockPolicies } = await import(
      './startup/deferredTasks/setupRuntimeUnlockPolicies'
    );
    startSetupRuntimeUnlockPolicies();
  }, STARTUP_TASKS.setupRuntimeUnlockPolicies);
}

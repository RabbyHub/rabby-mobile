/**
 * Files that are allowed to register startup tasks.
 *
 * This is a governance manifest, not a runtime importer. A file listed here
 * must still be reached by the appropriate launch, deferred, or route owner.
 * The startup governance checker verifies every active runStartupTask call is
 * listed so task registration does not spread through incidental imports.
 */
export const STARTUP_LAUNCH_TASK_MODULE_FILES = [
  'src/startup/launchTasks.ts',
] as const;

export const STARTUP_DEFERRED_TASK_MODULE_FILES = [
  'src/components2024/GlobalBottomSheetModal/GlobalBottomSheetModal.tsx',
  'src/hooks/browser/useBrowser.ts',
  'src/hooks/perps/usePerpsStore.ts',
  'src/hooks/useCexSupportList.ts',
  'src/screens/GasAccount/hooks/atom.ts',
  'src/screens/Home/hooks/history.ts',
  'src/setup-app-before-render.runtime.ts',
] as const;

export const STARTUP_ROUTE_OWNED_TASK_MODULE_FILES = [
  'src/screens/Address/components/MultiAssets/TabsMultiAssets.tsx',
] as const;

export const STARTUP_TASK_MODULE_FILES = [
  ...STARTUP_LAUNCH_TASK_MODULE_FILES,
  ...STARTUP_DEFERRED_TASK_MODULE_FILES,
  ...STARTUP_ROUTE_OWNED_TASK_MODULE_FILES,
] as const;

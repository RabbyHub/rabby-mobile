import type { StartupPhase } from './phaseRegistry';

type LaunchPhaseControllerDependencies = {
  advanceStartupPhase: (phase: StartupPhase, reason?: string) => void;
  startPerformanceRecording: (reason: string) => void;
};

export function createLaunchPhaseController(
  dependencies: LaunchPhaseControllerDependencies,
) {
  return {
    startLaunchPhase(reason = 'app_mounted') {
      dependencies.startPerformanceRecording(reason);
      dependencies.advanceStartupPhase('launch', reason);
    },
  };
}

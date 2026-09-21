import {
  INACTIVE_REGRESSION_SCENARIO_CONTEXT,
  type RegressionScenarioCommand,
  type RegressionScenarioContext,
  type RegressionScenarioEventName,
  type RegressionScenarioId,
  type RegressionScreenId,
} from './contracts';

export type RegressionScreenContextRuntime = {
  scenarioIncludesScreen: (
    scenario: RegressionScenarioId,
    screen: RegressionScreenId,
  ) => boolean;
  claimAction: (runId: string, actionKey: string) => boolean;
  report: (
    name: RegressionScenarioEventName,
    data?: Readonly<Record<string, unknown>>,
  ) => void;
};

export function makeScreenContext(
  screen: RegressionScreenId,
  enabled: boolean,
  command: RegressionScenarioCommand | null,
  isScreenFocused: () => boolean,
  runtime: RegressionScreenContextRuntime,
): RegressionScenarioContext {
  if (
    !enabled ||
    !isScreenFocused() ||
    !command?.scenario ||
    (command.screen
      ? command.screen !== screen
      : !runtime.scenarioIncludesScreen(command.scenario, screen))
  ) {
    return INACTIVE_REGRESSION_SCENARIO_CONTEXT;
  }

  return {
    active: true,
    runId: command.runId,
    scenario: command.scenario,
    screen,
    action: command.action,
    fixture: command.fixture,
    credentialProfile: command.credentialProfile,
    params: command.params,
    claimOnce: actionKey =>
      isScreenFocused() && runtime.claimAction(command.runId, actionKey),
    report: runtime.report,
  };
}

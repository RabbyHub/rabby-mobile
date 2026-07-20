import type { ComponentType } from 'react';

import {
  INACTIVE_REGRESSION_SCENARIO_CONTEXT,
  type RegressionScenarioContext,
  type RegressionScenarioRuntimeContext,
  type RegressionScreenId,
  type WithRegressionScenario,
} from './contracts';

export const withRegressionScenario = ((Component: ComponentType<object>) =>
  Component) as WithRegressionScenario;

export function useRegressionScenario<
  TScreen extends RegressionScreenId = RegressionScreenId,
>(): RegressionScenarioContext<TScreen> {
  return INACTIVE_REGRESSION_SCENARIO_CONTEXT;
}

export function useRegressionScenarioComponentAction(
  _action: string,
  _handler: () => void | Promise<void>,
) {}

export function useRegressionScenarioRuntime(): RegressionScenarioRuntimeContext {
  return INACTIVE_REGRESSION_SCENARIO_CONTEXT;
}

export function RegressionScenarioHost() {
  return null;
}

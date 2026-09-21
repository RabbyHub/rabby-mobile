import type {
  RegressionScenarioCommand,
  RegressionScenarioEventName,
} from './contracts';

export type RegressionScenarioExecutionContext = {
  command: RegressionScenarioCommand;
  report: (
    name: RegressionScenarioEventName,
    data?: Readonly<Record<string, unknown>>,
  ) => void;
  waitForNavigation: (timeoutMs?: number) => Promise<void>;
  waitForRoute: (routeName: string, timeoutMs?: number) => Promise<void>;
};

export type RegressionScenarioModule = {
  executeRegressionScenario: (
    context: RegressionScenarioExecutionContext,
  ) => Promise<void>;
};

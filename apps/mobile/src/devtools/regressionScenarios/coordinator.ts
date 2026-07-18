import { navigationRef } from '@/utils/navigation';

import type { RegressionScenarioCommand } from './contracts';
import { loadRegressionScenarioModule } from './registry';
import {
  beginRegressionScenarioRun,
  finishRegressionScenario,
  reportRegressionScenarioEvent,
} from './runtime.nonprod';

function waitFor(
  predicate: () => boolean,
  timeoutMs: number,
  description: string,
) {
  const startedAt = Date.now();

  return new Promise<void>((resolve, reject) => {
    const poll = () => {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error(`Timed out waiting for ${description}`));
        return;
      }
      setTimeout(poll, 50);
    };
    poll();
  });
}

export async function executeRegressionScenarioCommand(
  command: RegressionScenarioCommand,
) {
  if (command.action === 'finish') {
    finishRegressionScenario('passed');
    return;
  }
  if (!command.scenario) {
    finishRegressionScenario('failed', 'Scenario is required');
    return;
  }

  try {
    beginRegressionScenarioRun(
      command.action === 'prepare' || command.action === 'start'
        ? 'preparing'
        : 'running',
    );
    const module = await loadRegressionScenarioModule(command.scenario);
    beginRegressionScenarioRun('running');
    await module.executeRegressionScenario({
      command,
      report: reportRegressionScenarioEvent,
      waitForNavigation: (timeoutMs = 15_000) =>
        waitFor(
          () => navigationRef.isReady(),
          timeoutMs,
          'navigation readiness',
        ),
      waitForRoute: (routeName, timeoutMs = 15_000) =>
        waitFor(
          () =>
            navigationRef.isReady() &&
            navigationRef.getCurrentRoute()?.name === routeName,
          timeoutMs,
          `route ${routeName}`,
        ),
    });
    finishRegressionScenario('passed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    finishRegressionScenario('failed', message);
  }
}

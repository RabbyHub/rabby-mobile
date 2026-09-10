import { isWorkerThreadRunning, workerThread } from '@/perfs/thread';

import type { RegressionScenarioExecutionContext } from '../scenarioTypes';

const WORKER_RPC_TIMEOUT_MS = 5_000;
const WORKER_RPC_EXPECTED_RESULT = 42;

export async function executeRegressionScenario(
  context: RegressionScenarioExecutionContext,
) {
  await context.waitForNavigation();

  if (!isWorkerThreadRunning()) {
    context.report('action-started', {
      action: 'worker-start',
    });
    await workerThread.start();
  }

  if (!isWorkerThreadRunning()) {
    throw new Error('Computation worker did not report running after start');
  }

  context.report('precondition-ready', { workerRunning: true });

  context.report('action-started', {
    action: 'worker-rpc',
    type: 'plus',
  });

  const result = await workerThread.remoteCall(
    'plus',
    {
      leftValue: 40,
      rightValue: 2,
    },
    { timeout: WORKER_RPC_TIMEOUT_MS },
  );
  const passed = result === WORKER_RPC_EXPECTED_RESULT;

  context.report('assertion', {
    assertion: 'worker-thread-rpc-result',
    passed,
    expected: WORKER_RPC_EXPECTED_RESULT,
    actual: result,
  });

  if (!passed) {
    throw new Error(
      `Worker RPC returned ${String(
        result,
      )}, expected ${WORKER_RPC_EXPECTED_RESULT}`,
    );
  }

  if (!isWorkerThreadRunning()) {
    throw new Error('Computation worker stopped after a successful RPC');
  }

  context.report('postcondition-ready', {
    workerRunning: true,
    rpc: 'plus',
  });
}

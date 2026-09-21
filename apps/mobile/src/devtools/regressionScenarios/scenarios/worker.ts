import { isWorkerThreadRunning, workerThread } from '@/perfs/thread';

import type { RegressionScenarioExecutionContext } from '../scenarioTypes';

const WORKER_RPC_TIMEOUT_MS = 5_000;
const WORKER_RPC_EXPECTED_RESULT = 42;

async function assertWorkerRpc(
  context: RegressionScenarioExecutionContext,
  phase: string,
  leftValue: number,
  rightValue: number,
) {
  context.report('action-started', {
    action: 'worker-rpc',
    phase,
    type: 'plus',
  });

  const result = await workerThread.remoteCall(
    'plus',
    { leftValue, rightValue },
    { timeout: WORKER_RPC_TIMEOUT_MS },
  );
  const passed = result === WORKER_RPC_EXPECTED_RESULT;

  context.report('assertion', {
    assertion: 'worker-thread-rpc-result',
    phase,
    passed,
    expected: WORKER_RPC_EXPECTED_RESULT,
    actual: result,
  });

  if (!passed) {
    throw new Error(
      `Worker RPC returned ${String(
        result,
      )}, expected ${WORKER_RPC_EXPECTED_RESULT} during ${phase}`,
    );
  }
}

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

  await assertWorkerRpc(context, 'initial', 40, 2);

  context.report('action-started', {
    action: 'worker-restart',
    phase: 'first-restart',
  });
  await workerThread.restart();
  await assertWorkerRpc(context, 'after-first-restart', 20, 22);

  context.report('action-started', {
    action: 'worker-restart',
    phase: 'second-restart',
  });
  await workerThread.restart();
  await assertWorkerRpc(context, 'after-second-restart', 41, 1);

  if (!isWorkerThreadRunning()) {
    throw new Error('Computation worker stopped after a successful RPC');
  }

  context.report('postcondition-ready', {
    workerRunning: true,
    rpc: 'plus',
  });
}

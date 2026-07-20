type RegressionScenarioComponentAction = () => void | Promise<void>;

const registeredActions = new Map<
  string,
  Map<string, RegressionScenarioComponentAction>
>();

export function registerRegressionScenarioComponentAction(
  runId: string,
  action: string,
  handler: RegressionScenarioComponentAction,
) {
  const runActions =
    registeredActions.get(runId) ||
    new Map<string, RegressionScenarioComponentAction>();
  runActions.set(action, handler);
  registeredActions.set(runId, runActions);

  return () => {
    const currentRunActions = registeredActions.get(runId);
    if (currentRunActions?.get(action) !== handler) {
      return;
    }
    currentRunActions.delete(action);
    if (!currentRunActions.size) {
      registeredActions.delete(runId);
    }
  };
}

export async function runRegressionScenarioComponentAction(
  runId: string,
  action: string,
  timeoutMs = 5000,
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const handler = registeredActions.get(runId)?.get(action);
    if (handler) {
      await handler();
      return;
    }
    await new Promise<void>(resolve => setTimeout(resolve, 50));
  }

  throw new Error(`Timed out waiting for component action: ${action}`);
}

type RegressionScenarioComponentAction = () => void | Promise<void>;

export type RegressionScenarioComponentActionTiming = Readonly<{
  waitMs: number;
  handlerMs: number;
  totalMs: number;
}>;

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
      const handlerStartedAt = Date.now();
      const remainingMs = Math.max(
        1,
        timeoutMs - (handlerStartedAt - startedAt),
      );
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          Promise.resolve().then(handler),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              reject(
                new Error(`Timed out running component action: ${action}`),
              );
            }, remainingMs);
          }),
        ]);
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
      const finishedAt = Date.now();
      return {
        waitMs: handlerStartedAt - startedAt,
        handlerMs: finishedAt - handlerStartedAt,
        totalMs: finishedAt - startedAt,
      } satisfies RegressionScenarioComponentActionTiming;
    }
    await new Promise<void>(resolve => setTimeout(resolve, 50));
  }

  throw new Error(`Timed out waiting for component action: ${action}`);
}

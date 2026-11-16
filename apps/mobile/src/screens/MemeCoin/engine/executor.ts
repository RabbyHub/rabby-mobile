import {
  createPauseGate,
  ExecutionStoppedError,
  type PauseGate,
} from './pauseGate';
import {
  AUTO_RETRY_DELAY_MS,
  AUTO_RETRY_REASONS,
  BRIDGE_ARRIVAL_WATCH_DELAY_MS,
  MAX_AUTO_RETRIES,
} from './constants';
import type { ExecLeg, FailReason, LegState } from './types';

export type BroadcastResult =
  | { ok: true; txHash: string }
  | { ok: false; reason: FailReason };

export type LegRunner = {
  /** refresh → quote → checks → build → prefetch → sign/broadcast; calls gate.wait() before each step */
  prepareAndBroadcast(leg: ExecLeg, gate: PauseGate): Promise<BroadcastResult>;
  /**
   * true when the source-chain tx is mined successfully; no timeout (D5).
   * Throws ExecutionStoppedError once stopped or `isAbandoned` turns true.
   */
  waitForReceipt(
    leg: ExecLeg,
    txHash: string,
    gate: PauseGate,
    isAbandoned?: () => boolean,
  ): Promise<boolean>;
  /** bridge only: true when the target meme arrived; same stop rule as waitForReceipt */
  waitForArrival(
    leg: ExecLeg,
    txHash: string,
    gate: PauseGate,
    isAbandoned?: () => boolean,
  ): Promise<boolean>;
};

export type ExecutorCallbacks = {
  onLegState(key: string, state: LegState): void;
  onFinished(): void;
};

export type MemeTradeExecutor = {
  start(): void;
  /** While running: adds legs behind whatever is already queued on their chain. */
  enqueue(legs: ExecLeg[]): void;
  pause(): void;
  resume(): void;
  stop(): void;
};

export type ExecutorOptions = {
  retryDelay?: (ms: number) => Promise<void>;
  /** how long a bridge leg waits on its receipt alone before also watching the bridge */
  arrivalWatchDelay?: (ms: number) => Promise<void>;
};

const defaultRetryDelay = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

type Outcome<T> = { ok: true; value: T } | { ok: false; error: unknown };

/** never rejects, so an abandoned wait cannot surface as an unhandled rejection */
const outcomeOf = <T>(task: Promise<T>): Promise<Outcome<T>> =>
  task.then(
    value => ({ ok: true, value }),
    error => ({ ok: false, error }),
  );

/** `legs` must already be in execution order (amount desc, D16). */
export const createMemeTradeExecutor = (
  legs: ExecLeg[],
  runner: LegRunner,
  callbacks: ExecutorCallbacks,
  {
    retryDelay = defaultRetryDelay,
    arrivalWatchDelay = defaultRetryDelay,
  }: ExecutorOptions = {},
): MemeTradeExecutor => {
  const gate = createPauseGate();
  const chainTails = new Map<string, Promise<void>>();
  // Legs and bridge arrivals that have not settled; the last one ends the run.
  let unsettled = 0;
  let started = false;
  const setState = callbacks.onLegState;

  const settleOne = () => {
    unsettled -= 1;
    if (unsettled === 0) {
      callbacks.onFinished();
    }
  };

  const settleError = (
    key: string,
    error: unknown,
    txHash?: string,
    failReason: FailReason = 'failed',
  ) =>
    setState(
      key,
      error instanceof ExecutionStoppedError
        ? { phase: 'cancelled', txHash }
        : { phase: 'failed', failReason, txHash },
    );

  const broadcastWithRetry = async (leg: ExecLeg): Promise<BroadcastResult> => {
    for (let attempt = 0; ; attempt++) {
      const canRetry = attempt < MAX_AUTO_RETRIES;
      try {
        const result = await runner.prepareAndBroadcast(leg, gate);
        if (
          result.ok ||
          !canRetry ||
          !AUTO_RETRY_REASONS.includes(result.reason)
        ) {
          return result;
        }
      } catch (error) {
        // Signing and sending errors come back as a result, so anything thrown
        // here happened before broadcast.
        if (error instanceof ExecutionStoppedError || !canRetry) {
          throw error;
        }
      }
      await retryDelay(AUTO_RETRY_DELAY_MS);
    }
  };

  const runLeg = async (leg: ExecLeg) => {
    let txHash: string | undefined;
    try {
      await gate.wait();
      setState(leg.key, { phase: 'preparing' });
      const result = await broadcastWithRetry(leg);
      if (!result.ok) {
        setState(leg.key, { phase: 'failed', failReason: result.reason });
        return;
      }
      const hash = result.txHash;
      txHash = hash;
      setState(leg.key, { phase: 'confirming', txHash: hash });
      if (leg.kind === 'bridge') {
        await settleBridgeSource(leg, hash);
        return;
      }
      if (!(await runner.waitForReceipt(leg, hash, gate))) {
        setState(leg.key, {
          phase: 'failed',
          failReason: 'failed',
          txHash: hash,
        });
        return;
      }
      setState(leg.key, { phase: 'success', txHash: hash });
    } catch (error) {
      settleError(leg.key, error, txHash);
    }
  };

  const setArrivalState = (key: string, hash: string, arrived: boolean) =>
    setState(
      key,
      arrived
        ? { phase: 'success', txHash: hash }
        : { phase: 'failed', failReason: 'arrivalFailed', txHash: hash },
    );

  /**
   * Resolves once the source side is known, which frees the chain queue. A
   * receipt that is still missing after a while no longer blocks the leg: the
   * bridge status then runs alongside it, and a finished bridge settles the leg,
   * as the source tx must have been mined for it to finish. Throws like runLeg.
   */
  const settleBridgeSource = async (leg: ExecLeg, hash: string) => {
    let legDone = false;
    const isAbandoned = () => legDone;
    const receipt = outcomeOf(
      runner.waitForReceipt(leg, hash, gate, isAbandoned),
    );
    let arrival: Promise<Outcome<boolean>> | undefined;
    const watchArrival = () =>
      (arrival ??= outcomeOf(
        runner.waitForArrival(leg, hash, gate, isAbandoned),
      ));

    const fromReceipt = (outcome: Outcome<boolean>) =>
      ({ source: 'receipt', outcome } as const);
    let first:
      | ReturnType<typeof fromReceipt>
      | { source: 'arrival'; outcome: Outcome<boolean> }
      | { source: 'watch' } = await Promise.race([
      receipt.then(fromReceipt),
      arrivalWatchDelay(BRIDGE_ARRIVAL_WATCH_DELAY_MS).then(
        () => ({ source: 'watch' } as const),
      ),
    ]);
    if (first.source === 'watch') {
      first = await Promise.race([
        receipt.then(fromReceipt),
        watchArrival().then(outcome => ({
          source: 'arrival' as const,
          outcome,
        })),
      ]);
    }

    if (!first.outcome.ok) {
      legDone = true;
      throw first.outcome.error;
    }
    if (first.source === 'arrival') {
      legDone = true;
      setArrivalState(leg.key, hash, first.outcome.value);
      return;
    }
    if (!first.outcome.value) {
      legDone = true;
      setState(leg.key, {
        phase: 'failed',
        failReason: 'failed',
        txHash: hash,
      });
      return;
    }

    setState(leg.key, { phase: 'arriving', txHash: hash });
    unsettled += 1;
    watchArrival()
      .then(outcome => {
        if (outcome.ok) {
          setArrivalState(leg.key, hash, outcome.value);
        } else {
          settleError(leg.key, outcome.error, hash, 'arrivalFailed');
        }
      })
      .then(settleOne);
  };

  const runQueuedLeg = async (leg: ExecLeg) => {
    if (gate.isStopped()) {
      setState(leg.key, { phase: 'cancelled' });
    } else {
      await runLeg(leg);
    }
    settleOne();
  };

  const enqueue = (newLegs: ExecLeg[]) => {
    unsettled += newLegs.length;
    newLegs.forEach(leg => {
      setState(leg.key, { phase: 'queued' });
      const tail = chainTails.get(leg.pay.chain) ?? Promise.resolve();
      chainTails.set(
        leg.pay.chain,
        tail.then(() => runQueuedLeg(leg)),
      );
    });
  };

  return {
    start() {
      if (started) {
        return;
      }
      started = true;
      enqueue(legs);
      if (!legs.length) {
        callbacks.onFinished();
      }
    },
    enqueue,
    pause: () => gate.pause(),
    resume: () => gate.resume(),
    stop: () => gate.stop(),
  };
};

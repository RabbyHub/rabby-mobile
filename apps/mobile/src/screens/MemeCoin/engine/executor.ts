import {
  createPauseGate,
  ExecutionStoppedError,
  type PauseGate,
} from './pauseGate';
import type { ExecLeg, FailReason, LegState } from './types';

export type BroadcastResult =
  | { ok: true; txHash: string }
  | { ok: false; reason: FailReason };

export type LegRunner = {
  /** refresh → quote → checks → build → prefetch → sign/broadcast; calls gate.wait() before each step */
  prepareAndBroadcast(leg: ExecLeg, gate: PauseGate): Promise<BroadcastResult>;
  /** true when the source-chain tx is mined successfully; no timeout (D5) */
  waitForReceipt(
    leg: ExecLeg,
    txHash: string,
    gate: PauseGate,
  ): Promise<boolean>;
  /** bridge only: true when the target meme arrived */
  waitForArrival(
    leg: ExecLeg,
    txHash: string,
    gate: PauseGate,
  ): Promise<boolean>;
};

export type ExecutorCallbacks = {
  onLegState(key: string, state: LegState): void;
  onFinished(): void;
};

export type MemeTradeExecutor = {
  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;
};

const groupByPayChain = (legs: ExecLeg[]) => {
  const groups = new Map<string, ExecLeg[]>();
  legs.forEach(leg => {
    groups.set(leg.pay.chain, [...(groups.get(leg.pay.chain) ?? []), leg]);
  });
  return Array.from(groups.values());
};

/** `legs` must already be in execution order (amount desc, D16). */
export const createMemeTradeExecutor = (
  legs: ExecLeg[],
  runner: LegRunner,
  callbacks: ExecutorCallbacks,
): MemeTradeExecutor => {
  const gate = createPauseGate();
  const arrivals: Promise<void>[] = [];
  let started = false;
  const setState = callbacks.onLegState;

  const settleError = (key: string, error: unknown, txHash?: string) =>
    setState(
      key,
      error instanceof ExecutionStoppedError
        ? { phase: 'cancelled', txHash }
        : { phase: 'failed', failReason: 'failed', txHash },
    );

  const runLeg = async (leg: ExecLeg) => {
    let txHash: string | undefined;
    try {
      await gate.wait();
      setState(leg.key, { phase: 'preparing' });
      const result = await runner.prepareAndBroadcast(leg, gate);
      if (!result.ok) {
        setState(leg.key, { phase: 'failed', failReason: result.reason });
        return;
      }
      const hash = result.txHash;
      txHash = hash;
      setState(leg.key, { phase: 'confirming', txHash: hash });
      if (!(await runner.waitForReceipt(leg, hash, gate))) {
        setState(leg.key, {
          phase: 'failed',
          failReason: 'failed',
          txHash: hash,
        });
        return;
      }
      if (leg.kind === 'swap') {
        setState(leg.key, { phase: 'success', txHash: hash });
        return;
      }
      setState(leg.key, { phase: 'arriving', txHash: hash });
      arrivals.push(
        runner.waitForArrival(leg, hash, gate).then(
          arrived =>
            setState(
              leg.key,
              arrived
                ? { phase: 'success', txHash: hash }
                : { phase: 'failed', failReason: 'failed', txHash: hash },
            ),
          error => settleError(leg.key, error, hash),
        ),
      );
    } catch (error) {
      settleError(leg.key, error, txHash);
    }
  };

  const runChain = async (chainLegs: ExecLeg[]) => {
    for (const leg of chainLegs) {
      if (gate.isStopped()) {
        setState(leg.key, { phase: 'cancelled' });
        continue;
      }
      await runLeg(leg);
    }
  };

  return {
    start() {
      if (started) {
        return;
      }
      started = true;
      legs.forEach(leg => setState(leg.key, { phase: 'queued' }));
      Promise.all(groupByPayChain(legs).map(runChain))
        .then(() => Promise.all(arrivals))
        .then(() => callbacks.onFinished());
    },
    pause: () => gate.pause(),
    resume: () => gate.resume(),
    stop: () => gate.stop(),
  };
};

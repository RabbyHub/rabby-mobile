import { createPauseGate, ExecutionStoppedError } from './pauseGate';

describe('createPauseGate', () => {
  it('passes immediately while running', async () => {
    await expect(createPauseGate().wait()).resolves.toBeUndefined();
  });

  it('blocks while paused and continues on resume', async () => {
    const gate = createPauseGate();
    gate.pause();
    let passed = false;
    const waiting = gate.wait().then(() => {
      passed = true;
    });
    await Promise.resolve();
    expect(passed).toBe(false);
    gate.resume();
    await waiting;
    expect(passed).toBe(true);
  });

  it('rejects pending and future waits after stop, and ignores resume', async () => {
    const gate = createPauseGate();
    gate.pause();
    const pending = gate.wait();
    gate.stop();
    await expect(pending).rejects.toBeInstanceOf(ExecutionStoppedError);
    gate.resume();
    await expect(gate.wait()).rejects.toBeInstanceOf(ExecutionStoppedError);
    expect(gate.isStopped()).toBe(true);
  });
});

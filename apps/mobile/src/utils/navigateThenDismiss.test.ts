import { navigateThenDismiss } from './navigateThenDismiss';

describe('navigateThenDismiss', () => {
  const rafQueue: Array<(time: number) => void> = [];
  const originalRaf = (global as any).requestAnimationFrame;

  beforeEach(() => {
    rafQueue.length = 0;
    (global as any).requestAnimationFrame = (cb: (time: number) => void) => {
      rafQueue.push(cb);
      return rafQueue.length;
    };
  });

  afterAll(() => {
    (global as any).requestAnimationFrame = originalRaf;
  });

  const flushFrame = () => {
    const next = rafQueue.shift();
    expect(next).toBeDefined();
    next!(0);
  };

  it('navigates first and defers the dismiss past two frames', () => {
    const calls: string[] = [];
    navigateThenDismiss(
      () => calls.push('navigate'),
      () => calls.push('dismiss'),
    );

    expect(calls).toEqual(['navigate']);
    flushFrame();
    expect(calls).toEqual(['navigate']);
    flushFrame();
    expect(calls).toEqual(['navigate', 'dismiss']);
  });

  it('navigates without scheduling frames when nothing needs dismissing', () => {
    const navigate = jest.fn();
    navigateThenDismiss(navigate);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(rafQueue).toHaveLength(0);
  });
});

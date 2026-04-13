import { devLog } from './logger';

describe('devLog', () => {
  const originalDev = (globalThis as any).__DEV__;

  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as any).__DEV__ = originalDev;
  });

  afterAll(() => {
    (globalThis as any).__DEV__ = originalDev;
  });

  it('logs bare keys when no extra info is provided', () => {
    (globalThis as any).__DEV__ = true;
    const logSpy = jest.spyOn(console, 'log').mockImplementation();

    devLog('simple');

    expect(logSpy).toHaveBeenCalledWith('simple');
  });

  it('prefixes the key when extra info is provided', () => {
    (globalThis as any).__DEV__ = true;
    const logSpy = jest.spyOn(console, 'log').mockImplementation();

    devLog('scope', 'a', 1);

    expect(logSpy).toHaveBeenCalledWith('[scope]', 'a', 1);
  });

  it('does nothing outside dev mode', () => {
    (globalThis as any).__DEV__ = false;
    const logSpy = jest.spyOn(console, 'log').mockImplementation();

    devLog('scope', 'a', 1);

    expect(logSpy).not.toHaveBeenCalled();
  });
});

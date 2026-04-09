const mockTrigger = jest.fn();

function loadCommonModule() {
  jest.resetModules();

  jest.doMock('react-native-haptic-feedback', () => ({
    trigger: (...args: unknown[]) => mockTrigger(...args),
  }));

  return require('./common') as typeof import('./common');
}

describe('common utils', () => {
  const originalDev = (globalThis as any).__DEV__;

  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as any).__DEV__ = originalDev;
  });

  afterAll(() => {
    (globalThis as any).__DEV__ = originalDev;
  });

  it('extracts the registrable name from an origin-like string', () => {
    const { getOriginName } = loadCommonModule();

    expect(getOriginName('https://app.uniswap.org')).toBe('uniswap');
    expect(getOriginName('https://debank.com')).toBe('debank');
    expect(getOriginName('localhost:3000')).toBe('localhost:3000');
  });

  it('keeps hashCode stable for the same string and returns 0 for empty input', () => {
    const { hashCode } = loadCommonModule();

    expect(hashCode('')).toBe(0);
    expect(hashCode('abc')).toBe(96354);
    expect(hashCode('abc')).toBe(hashCode('abc'));
  });

  it('compares strings case-insensitively', () => {
    const { lowcaseSame } = loadCommonModule();

    expect(lowcaseSame('Rabby', 'rabby')).toBe(true);
    expect(lowcaseSame('Rabby', 'Debank')).toBe(false);
  });

  it('triggers impact haptics with the default options merged in', () => {
    const { triggerImpact } = loadCommonModule();

    triggerImpact({
      enableVibrateFallback: false,
    });

    expect(mockTrigger).toHaveBeenCalledWith('impactLight', {
      enableVibrateFallback: false,
      ignoreAndroidSystemSettings: false,
    });
  });

  it('skips dev-only haptics when __DEV__ is false', () => {
    const { triggerImpact } = loadCommonModule();
    (globalThis as any).__DEV__ = false;

    triggerImpact({
      __DEV_ONLY__: true,
    });

    expect(mockTrigger).not.toHaveBeenCalled();
  });
});

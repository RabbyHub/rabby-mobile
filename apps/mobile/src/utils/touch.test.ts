const mockTrigger = jest.fn();

function loadTouchModule() {
  jest.resetModules();

  jest.doMock('react-native-haptic-feedback', () => ({
    trigger: (...args: unknown[]) => mockTrigger(...args),
  }));

  return require('./touch') as typeof import('./touch');
}

describe('touchedFeedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('triggers the current default light-impact feedback', () => {
    const { touchedFeedback } = loadTouchModule();

    touchedFeedback();

    expect(mockTrigger).toHaveBeenCalledWith('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
  });
});

jest.mock('@/core/storage/mmkv', () => ({
  zustandByMMKV: jest.fn((_key: string, initialState: object) => {
    const { create } = jest.requireActual(
      'zustand',
    ) as typeof import('zustand');
    return create(() => initialState);
  }),
}));

jest.mock('@/core/utils/reexports', () => ({
  zCreate: jest.fn((initializer: () => object) => {
    const { create } = jest.requireActual(
      'zustand',
    ) as typeof import('zustand');
    return create(initializer);
  }),
}));

describe('upgrade prompt exposure receipt', () => {
  it('allows the same version to auto prompt again after resetting exposure', () => {
    jest.isolateModules(() => {
      const prompt =
        require('./useUpgradePrompt') as typeof import('./useUpgradePrompt');
      const info = {
        version: '0.6.85',
        couldUpgrade: true,
        changelog: 'Upgrade prompt test',
      };

      prompt.requestAutoUpgradePrompt(info);
      prompt.showPendingAutoUpgradePrompt();
      expect(prompt.isUpgradePromptVisible()).toBe(true);

      prompt.dismissUpgradePrompt();
      prompt.requestAutoUpgradePrompt(info);
      prompt.showPendingAutoUpgradePrompt();
      expect(prompt.isUpgradePromptVisible()).toBe(false);

      prompt.resetUpgradePromptExposure();
      prompt.requestAutoUpgradePrompt(info);
      prompt.showPendingAutoUpgradePrompt();
      expect(prompt.isUpgradePromptVisible()).toBe(true);
    });
  });
});

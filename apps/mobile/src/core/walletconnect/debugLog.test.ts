describe('walletconnect debug log', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('keeps long serialized data intact', () => {
    const { addWalletConnectLog } =
      require('./debugLog') as typeof import('./debugLog');
    const { getWalletConnectDebugState } =
      require('./state') as typeof import('./state');
    const value = `${'x'.repeat(2500)}tail`;

    addWalletConnectLog('proposal', 'large proposal', {
      methods: [value],
    });

    const [entry] = getWalletConnectDebugState().log;
    expect(entry.data).toContain(value);
    expect(entry.data).toContain('tail');
  });
});

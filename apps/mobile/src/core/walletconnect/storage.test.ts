import { walletConnectStorage } from './storage';

describe('walletconnect storage', () => {
  beforeEach(async () => {
    const keys = await walletConnectStorage.getKeys();
    await Promise.all(keys.map(key => walletConnectStorage.removeItem(key)));
  });

  it('round-trips json and string values', async () => {
    await walletConnectStorage.setItem('object', {
      topic: 'test-topic',
      expiry: 123,
    });
    await walletConnectStorage.setItem('string', 'raw-value');

    await expect(walletConnectStorage.getItem('object')).resolves.toEqual({
      topic: 'test-topic',
      expiry: 123,
    });
    await expect(walletConnectStorage.getItem('string')).resolves.toBe(
      'raw-value',
    );
  });

  it('returns undefined for missing keys', async () => {
    await expect(walletConnectStorage.getItem('missing')).resolves.toBe(
      undefined,
    );
  });

  it('returns parsed entries', async () => {
    await walletConnectStorage.setItem('session', { topic: 'abc' });

    await expect(walletConnectStorage.getEntries()).resolves.toEqual([
      ['session', { topic: 'abc' }],
    ]);
  });
});

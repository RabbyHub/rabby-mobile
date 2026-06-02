import { respondSessionRequestOnce } from './requestResponse';

jest.mock('./debugLog', () => ({
  addWalletConnectLog: jest.fn(),
}));

describe('walletconnect request response', () => {
  it('responds to a session request only once', async () => {
    const walletKit = {
      respondSessionRequest: jest.fn().mockResolvedValue(undefined),
    };
    const response = {
      id: 97001,
      jsonrpc: '2.0' as const,
      result: '0x1',
    };

    await expect(
      respondSessionRequestOnce({
        walletKit,
        topic: 'topic-a',
        id: response.id,
        response,
      }),
    ).resolves.toBe(true);
    await expect(
      respondSessionRequestOnce({
        walletKit,
        topic: 'topic-a',
        id: response.id,
        response,
      }),
    ).resolves.toBe(false);

    expect(walletKit.respondSessionRequest).toHaveBeenCalledTimes(1);
  });
});

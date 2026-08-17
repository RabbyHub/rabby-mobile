jest.mock('@/core/native/RNHelpers', () => ({
  __esModule: true,
  default: {
    startNativeNftSync: jest.fn(),
    cancelNativeNftCacheSync: jest.fn(),
    cancelAllNativeNftCacheSyncs: jest.fn(),
  },
}));

jest.mock('@/hooks/appSettings', () => ({
  getNativeNftSyncEnabled: jest.fn(),
}));

jest.mock('./nativeAssetSyncEvents', () => ({
  ensureNativeAssetSyncEventsStarted: jest.fn(),
}));

jest.mock('./nativeAssetSyncReceipt', () => ({
  waitForNativeAssetSyncCompletion: jest.fn(),
}));

import RNHelpers from '@/core/native/RNHelpers';
import { getNativeNftSyncEnabled } from '@/hooks/appSettings';

import { ensureNativeAssetSyncEventsStarted } from './nativeAssetSyncEvents';
import { waitForNativeAssetSyncCompletion } from './nativeAssetSyncReceipt';
import { executeNftSync, getNftSyncMode } from './nftSyncExecutor';

describe('nftSyncExecutor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the persisted non-production mode', () => {
    jest.mocked(getNativeNftSyncEnabled).mockReturnValueOnce(true);
    expect(getNftSyncMode()).toBe('native');
    jest.mocked(getNativeNftSyncEnabled).mockReturnValueOnce(false);
    expect(getNftSyncMode()).toBe('js');
  });

  it('preserves the existing JS execution contract', async () => {
    const executeJs = jest.fn().mockResolvedValue({ nfts: ['js'] });

    await expect(
      executeNftSync({
        mode: 'js',
        address: '0x0000000000000000000000000000000000000001',
        replaceExisting: true,
        executeJs,
      }),
    ).resolves.toEqual({
      mode: 'js',
      value: { nfts: ['js'] },
    });
    expect(RNHelpers.cancelNativeNftCacheSync).toHaveBeenCalledTimes(1);
    expect(RNHelpers.startNativeNftSync).not.toHaveBeenCalled();
  });

  it('waits for the native NFT commit to be applied', async () => {
    const completion = {
      schemaVersion: 1 as const,
      requestId: 'nft-request',
      kind: 'nft' as const,
      success: true,
      address: '0x0000000000000000000000000000000000000001',
      generation: 2,
      committedAt: 10,
      replacementScope: 'address' as const,
      chainIds: [],
      committedRowCount: 3,
      stage: 'persistence',
      error: '',
    };
    jest.mocked(RNHelpers.startNativeNftSync).mockResolvedValue({
      requestId: completion.requestId,
    });
    jest.mocked(waitForNativeAssetSyncCompletion).mockResolvedValue(completion);

    await expect(
      executeNftSync({
        mode: 'native',
        address: completion.address,
        replaceExisting: true,
        executeJs: jest.fn(),
      }),
    ).resolves.toEqual({ mode: 'native', result: completion });
    expect(ensureNativeAssetSyncEventsStarted).toHaveBeenCalledTimes(1);
    expect(RNHelpers.startNativeNftSync).toHaveBeenCalledWith(
      completion.address,
      true,
    );
  });
});

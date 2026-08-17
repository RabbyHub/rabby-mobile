jest.mock('@/core/native/RNHelpers', () => ({
  __esModule: true,
  default: {
    startNativeProtocolSync: jest.fn(),
    cancelNativeProtocolCacheSync: jest.fn(),
    cancelAllNativeProtocolCacheSyncs: jest.fn(),
  },
}));

jest.mock('@/hooks/appSettings', () => ({
  getNativeProtocolSyncEnabled: jest.fn(),
}));

jest.mock('./nativeAssetSyncEvents', () => ({
  ensureNativeAssetSyncEventsStarted: jest.fn(),
}));

jest.mock('./nativeAssetSyncReceipt', () => ({
  waitForNativeAssetSyncCompletion: jest.fn(),
}));

import RNHelpers from '@/core/native/RNHelpers';
import { getNativeProtocolSyncEnabled } from '@/hooks/appSettings';

import { ensureNativeAssetSyncEventsStarted } from './nativeAssetSyncEvents';
import { waitForNativeAssetSyncCompletion } from './nativeAssetSyncReceipt';
import {
  executeProtocolSync,
  getProtocolSyncMode,
} from './protocolSyncExecutor';

describe('protocolSyncExecutor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the persisted non-production mode', () => {
    jest.mocked(getNativeProtocolSyncEnabled).mockReturnValueOnce(true);
    expect(getProtocolSyncMode()).toBe('native');
    jest.mocked(getNativeProtocolSyncEnabled).mockReturnValueOnce(false);
    expect(getProtocolSyncMode()).toBe('js');
  });

  it('preserves the existing JS execution contract', async () => {
    const executeJs = jest.fn().mockResolvedValue({ protocols: ['js'] });

    await expect(
      executeProtocolSync({
        mode: 'js',
        address: '0x0000000000000000000000000000000000000001',
        replaceExisting: true,
        executeJs,
      }),
    ).resolves.toEqual({
      mode: 'js',
      value: { protocols: ['js'] },
    });
    expect(RNHelpers.cancelNativeProtocolCacheSync).toHaveBeenCalledTimes(1);
    expect(RNHelpers.startNativeProtocolSync).not.toHaveBeenCalled();
  });

  it('waits for the native protocol commit to be applied', async () => {
    const completion = {
      schemaVersion: 1 as const,
      requestId: 'protocol-request',
      kind: 'protocol' as const,
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
    jest.mocked(RNHelpers.startNativeProtocolSync).mockResolvedValue({
      requestId: completion.requestId,
    });
    jest.mocked(waitForNativeAssetSyncCompletion).mockResolvedValue(completion);

    await expect(
      executeProtocolSync({
        mode: 'native',
        address: completion.address,
        replaceExisting: true,
        executeJs: jest.fn(),
      }),
    ).resolves.toEqual({ mode: 'native', result: completion });
    expect(ensureNativeAssetSyncEventsStarted).toHaveBeenCalledTimes(1);
    expect(RNHelpers.startNativeProtocolSync).toHaveBeenCalledWith(
      completion.address,
      true,
    );
  });
});

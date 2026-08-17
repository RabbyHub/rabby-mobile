jest.mock('@/core/native/RNHelpers', () => ({
  __esModule: true,
  default: {
    syncNativeTokenChains: jest.fn(),
    cancelNativeTokenCacheSync: jest.fn(),
    cancelAllNativeTokenCacheSyncs: jest.fn(),
  },
}));

jest.mock('@/databases/sync/abort', () => ({
  registerSyncAbortHandler: jest.fn(),
}));

jest.mock('@/hooks/appSettings', () => ({
  getNativeTokenChainSyncEnabled: jest.fn(),
}));

import RNHelpers from '@/core/native/RNHelpers';
import { registerSyncAbortHandler } from '@/databases/sync/abort';
import { getNativeTokenChainSyncEnabled } from '@/hooks/appSettings';
import {
  executeTokenChainSync,
  getTokenChainSyncMode,
} from './tokenChainSyncExecutor';

const mockNativeSuccess = {
  success: true,
  address: '0xabc',
  generation: 7,
  stage: 'committed',
  chainCount: 2,
  sourceTokenCount: 4,
  filteredTokenCount: 3,
  committedRowCount: 3,
  durationMs: 10,
  error: '',
};
const registeredAbortHandler = jest.mocked(registerSyncAbortHandler).mock
  .calls[0]?.[0];

describe('tokenChainSyncExecutor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('selects the persisted native mode only when it is enabled', () => {
    jest.mocked(getNativeTokenChainSyncEnabled).mockReturnValueOnce(true);
    expect(getTokenChainSyncMode()).toBe('native');

    jest.mocked(getNativeTokenChainSyncEnabled).mockReturnValueOnce(false);
    expect(getTokenChainSyncMode()).toBe('js');
  });

  it('cancels an older native operation before using the JS path', async () => {
    const executeJs = jest.fn().mockResolvedValue(['token']);

    await expect(
      executeTokenChainSync({
        mode: 'js',
        address: '0xabc',
        chainIds: ['eth'],
        replacementScope: 'address',
        replaceExisting: true,
        executeJs,
      }),
    ).resolves.toEqual({ mode: 'js', value: ['token'] });

    expect(RNHelpers.cancelNativeTokenCacheSync).toHaveBeenCalledWith('0xabc');
    expect(RNHelpers.syncNativeTokenChains).not.toHaveBeenCalled();
  });

  it('uses the formal native bridge without running the JS callback', async () => {
    jest
      .mocked(RNHelpers.syncNativeTokenChains)
      .mockResolvedValue(mockNativeSuccess);
    const executeJs = jest.fn();

    await expect(
      executeTokenChainSync({
        mode: 'native',
        address: '0xabc',
        chainIds: ['eth', 'arb'],
        replacementScope: 'chains',
        replaceExisting: true,
        executeJs,
      }),
    ).resolves.toEqual({ mode: 'native', result: mockNativeSuccess });

    expect(RNHelpers.syncNativeTokenChains).toHaveBeenCalledWith(
      '0xabc',
      ['eth', 'arb'],
      'chains',
      true,
    );
    expect(executeJs).not.toHaveBeenCalled();
  });

  it('surfaces native failures without falling back to JS', async () => {
    jest.mocked(RNHelpers.syncNativeTokenChains).mockResolvedValue({
      ...mockNativeSuccess,
      success: false,
      stage: 'persistence',
      error: 'commit failed',
    });
    const executeJs = jest.fn();

    await expect(
      executeTokenChainSync({
        mode: 'native',
        address: '0xabc',
        chainIds: ['eth'],
        replacementScope: 'address',
        replaceExisting: true,
        executeJs,
      }),
    ).rejects.toThrow('Native token chain sync failed at persistence');
    expect(executeJs).not.toHaveBeenCalled();
  });

  it('registers clear-cache cancellation for all native operations', () => {
    expect(registeredAbortHandler).toBeDefined();

    registeredAbortHandler?.();
    expect(RNHelpers.cancelAllNativeTokenCacheSyncs).toHaveBeenCalledTimes(1);
  });
});

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { preferenceService } from '@/core/services';
import {
  getUserTokenSettingsInMemory,
  useUserTokenSettings,
} from './useTokenSettings';

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

const mockMakeSettings = (
  overrides: Partial<ReturnType<typeof getUserTokenSettingsInMemory>> = {},
) => ({
  foldTokens: [],
  unfoldTokens: [],
  includeDefiAndTokens: [],
  excludeDefiAndTokens: [],
  pinedQueue: [],
  foldNfts: [],
  unfoldNfts: [],
  foldDefis: [],
  unFoldDefis: [],
  ...overrides,
});

let mockCurrentSettings = mockMakeSettings();

jest.mock('@/core/services', () => ({
  preferenceService: {
    getUserTokenSettings: jest.fn(() => mockCurrentSettings),
    pinToken: jest.fn(({ tokenId, chainId }) => {
      mockCurrentSettings = mockMakeSettings({
        ...mockCurrentSettings,
        pinedQueue: [{ tokenId, chainId }],
      });
    }),
    removePinedToken: jest.fn(({ tokenId, chainId }) => {
      mockCurrentSettings = mockMakeSettings({
        ...mockCurrentSettings,
        pinedQueue: mockCurrentSettings.pinedQueue.filter(
          item => item.tokenId !== tokenId || item.chainId !== chainId,
        ),
      });
    }),
  },
}));

const getUserTokenSettings =
  preferenceService.getUserTokenSettings as jest.Mock;
const pinToken = preferenceService.pinToken as jest.Mock;
const removePinedToken = preferenceService.removePinedToken as jest.Mock;

describe('useUserTokenSettings', () => {
  beforeEach(() => {
    mockCurrentSettings = mockMakeSettings();
    jest.clearAllMocks();

    const { result, unmount } = renderHook(() => useUserTokenSettings());
    act(() => {
      result.current.setUserTokenSettings(mockMakeSettings());
    });
    unmount();
  });

  it('preserves default buckets while applying partial store updates', () => {
    mockCurrentSettings = mockMakeSettings({
      pinedQueue: [{ tokenId: 'eth', chainId: 'eth' }],
    });

    const { result } = renderHook(() => useUserTokenSettings());

    expect(result.current.userTokenSettings.pinedQueue).toEqual([]);

    act(() => {
      result.current.setUserTokenSettings({
        pinedQueue: [{ tokenId: 'usdc', chainId: 'arb' }],
      } as never);
    });

    expect(result.current.userTokenSettings.pinedQueue).toEqual([
      { tokenId: 'usdc', chainId: 'arb' },
    ]);
    expect(result.current.userTokenSettings.foldTokens).toEqual([]);
  });

  it('fetches the latest persisted settings into the hook store', async () => {
    const { result } = renderHook(() => useUserTokenSettings());

    mockCurrentSettings = mockMakeSettings({
      pinedQueue: [{ tokenId: 'dai', chainId: 'eth' }],
      includeDefiAndTokens: ['dai'],
    });

    await act(async () => {
      await result.current.fetchUserTokenSettings();
    });

    expect(getUserTokenSettings).toHaveBeenCalled();
    expect(result.current.userTokenSettings.pinedQueue).toEqual([
      { tokenId: 'dai', chainId: 'eth' },
    ]);
    expect(result.current.userTokenSettings.includeDefiAndTokens).toEqual([
      'dai',
    ]);
  });

  it('pins and unpins tokens through preferenceService and refreshes memory', async () => {
    const { result } = renderHook(() => useUserTokenSettings());

    act(() => {
      result.current.pinToken({ id: 'usdt', chain: 'bsc' });
    });

    expect(pinToken).toHaveBeenCalledWith({
      tokenId: 'usdt',
      chainId: 'bsc',
    });
    await waitFor(() => {
      expect(result.current.userTokenSettings.pinedQueue).toEqual([
        { tokenId: 'usdt', chainId: 'bsc' },
      ]);
    });

    act(() => {
      result.current.removePinedToken({ id: 'usdt', chain: 'bsc' });
    });

    expect(removePinedToken).toHaveBeenCalledWith({
      tokenId: 'usdt',
      chainId: 'bsc',
    });
    await waitFor(() => {
      expect(result.current.userTokenSettings.pinedQueue).toEqual([]);
    });
  });
});

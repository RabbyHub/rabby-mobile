import { act, renderHook } from '@testing-library/react-native';

const mockEnsureApproval = jest.fn(async () => undefined);
const mockBuildCommand = jest.fn((input: object) => input);
const mockExecute = jest.fn(async () => ({ kind: 'success' }));
const mockShowToast = jest.fn();
const mockUpdateActiveAssetLeverageCache = jest.fn();

jest.mock('@/hooks/perps/actions/actionError', () => ({
  isPerpsActionUserCancelled: () => false,
}));

jest.mock('@/hooks/perps/actions/perpsActionApproval', () => ({
  ensurePerpsActionApproval: (...args: unknown[]) =>
    mockEnsureApproval(...args),
}));

jest.mock('@/hooks/perps/actions/updateLeverage', () => ({
  buildPerpsUpdateLeverageCommand: (...args: unknown[]) =>
    mockBuildCommand(...args),
  executePerpsUpdateLeverage: (...args: unknown[]) => mockExecute(...args),
}));

jest.mock('@/hooks/perps/perpsActionError', () => ({
  judgeIsBuilderFeeNeedApprove: () => false,
  judgeIsUserAgentIsExpired: async () => false,
}));

jest.mock('@/hooks/perps/showToast', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

jest.mock('@/hooks/perps/useActiveAssetDataCache', () => ({
  updateActiveAssetLeverageCache: (...args: unknown[]) =>
    mockUpdateActiveAssetLeverageCache(...args),
}));

jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: { leverage?: number; reason?: string }) =>
      key.endsWith('leverageUpdated')
        ? `Leverage changed to ${params?.leverage}x`
        : key.endsWith('leverageUpdateFailed')
        ? `Cannot Change Leverage: ${params?.reason}`
        : key,
  }),
}));

import { usePerpsProLeverageUpdate } from './usePerpsProLeverageUpdate';

const account = {
  address: '0x0000000000000000000000000000000000000001',
  type: 'watch' as const,
};

describe('usePerpsProLeverageUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates once, refreshes both server projections and emits one Toast', async () => {
    const refreshActiveAssetData = jest.fn(async () => undefined);
    const hook = renderHook(() =>
      usePerpsProLeverageUpdate({ refreshActiveAssetData }),
    );
    let success = false;

    await act(async () => {
      success = await hook.result.current.update({
        account: account as never,
        coin: 'BTC',
        currentIsCross: false,
        currentLeverage: 10,
        isCross: false,
        leverage: 20,
        maxLeverage: 40,
      });
    });

    expect(success).toBe(true);
    expect(mockBuildCommand).toHaveBeenCalledWith(
      expect.objectContaining({ coin: 'BTC', leverage: 20 }),
    );
    expect(mockEnsureApproval).not.toHaveBeenCalled();
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockUpdateActiveAssetLeverageCache).toHaveBeenCalledWith(
      'BTC',
      account.address,
      { type: 'isolated', value: 20 },
    );
    expect(refreshActiveAssetData).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith(
      'Leverage changed to 20x',
      'success',
    );
  });

  it('uses the margin-mode copy and projects the accepted server mode', async () => {
    const refreshActiveAssetData = jest.fn(async () => undefined);
    const hook = renderHook(() =>
      usePerpsProLeverageUpdate({ refreshActiveAssetData }),
    );

    await act(async () => {
      expect(
        await hook.result.current.update({
          account: account as never,
          action: 'marginMode',
          coin: 'DOGE',
          currentIsCross: false,
          currentLeverage: 10,
          isCross: true,
          leverage: 10,
          maxLeverage: 20,
        }),
      ).toBe(true);
    });

    expect(mockUpdateActiveAssetLeverageCache).toHaveBeenCalledWith(
      'DOGE',
      account.address,
      { type: 'cross', value: 10 },
    );
    expect(refreshActiveAssetData).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.positions.marginUpdated',
      'success',
    );
  });

  it('closes an unchanged draft without a duplicate server update or Toast', async () => {
    const hook = renderHook(() =>
      usePerpsProLeverageUpdate({
        refreshActiveAssetData: jest.fn(async () => undefined),
      }),
    );

    await act(async () => {
      expect(
        await hook.result.current.update({
          account: account as never,
          coin: 'BTC',
          currentIsCross: false,
          currentLeverage: 10,
          isCross: false,
          leverage: 10,
          maxLeverage: 40,
        }),
      ).toBe(true);
    });

    expect(mockExecute).not.toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it('reports the server reason without requesting generic action approval', async () => {
    mockExecute.mockResolvedValueOnce({
      error: 'Insufficient margin',
      kind: 'failed',
    });
    const hook = renderHook(() =>
      usePerpsProLeverageUpdate({
        refreshActiveAssetData: jest.fn(async () => undefined),
      }),
    );

    await act(async () => {
      expect(
        await hook.result.current.update({
          account: account as never,
          coin: 'BTC',
          currentIsCross: false,
          currentLeverage: 10,
          isCross: false,
          leverage: 5,
          maxLeverage: 40,
        }),
      ).toBe(false);
    });

    expect(mockEnsureApproval).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(
      'Cannot Change Leverage: Insufficient margin',
      'error',
    );
  });
});

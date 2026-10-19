const mockNavigateDeprecated = jest.fn();
const mockResetNavigationOnTopOfHome = jest.fn();
const mockMarkFeatureActivation = jest.fn();

jest.mock('@/core/utils/reexports', () => ({
  zCreate: jest.requireActual('zustand').create,
}));

jest.mock('@/hooks/alias', () => ({
  useAlias2: () => ({
    adderssAlias: '',
    isDefaultAlias: true,
  }),
}));

jest.mock('@/hooks/useCurrentBalance', () => ({
  useAddressBalance: () => ({ balance: 0, evmBalance: 0 }),
  useIsLoadingBalance: () => ({ balanceLoading: false }),
}));

jest.mock('@/hooks/useCurve', () => ({
  useAddressCurveSelectData: () => ({
    list: [],
    changePercent: '',
    rawChange: 0,
    isLoss: false,
  }),
  useIsLoadingCurve: () => ({ isLoadingCurve: false }),
}));

jest.mock('@/store/curve24h', () => ({
  addressCurve24hStore: { useStore: {} },
}));

jest.mock('@/store/balance24h', () => ({
  balance24hStore: { useStore: {} },
  useAddress24hChangeFlowState: () => ({ isLoading: false }),
}));

jest.mock('@/store/homePortfolio/consistency', () => ({
  buildPortfolioAddressChange: () => null,
}));

jest.mock('@/utils/address', () => ({
  ellipsisAddress: (address: string) => address,
}));

jest.mock('@/utils/navigation', () => ({
  navigateDeprecated: (...args: unknown[]) => mockNavigateDeprecated(...args),
}));

jest.mock('@/hooks/navigation', () => ({
  resetNavigationOnTopOfHome: (...args: unknown[]) =>
    mockResetNavigationOnTopOfHome(...args),
}));

jest.mock('@/core/utils/featureActivationDiagnostics', () => ({
  beginFeatureActivation: () => 17,
  markFeatureActivation: (...args: unknown[]) =>
    mockMarkFeatureActivation(...args),
}));

import { RootNames } from '@/constant/layout';
import type { Account } from '@/core/startupServices/preference';
import { act, renderHook } from '@testing-library/react-native';
import { apisSingleHome, useSingleHomeNavigationCleanup } from './singleHome';

const account = {
  address: '0x1111111111111111111111111111111111111111',
  type: 'Simple Key Pair',
  brandName: 'Simple Key Pair',
} as Account;

describe('single address navigation', () => {
  beforeEach(() => {
    apisSingleHome.clearCurrentAccount(
      mockNavigateDeprecated.mock.lastCall?.[1].params.navigationId,
    );
    apisSingleHome.clearCurrentAccount(
      mockResetNavigationOnTopOfHome.mock.lastCall?.[1].params.navigationId,
    );
    mockNavigateDeprecated.mockClear();
    mockResetNavigationOnTopOfHome.mockClear();
    mockMarkFeatureActivation.mockClear();
  });

  it('prepares the account and dispatches navigation synchronously', () => {
    apisSingleHome.navigateToSingleHome(account);

    expect(apisSingleHome.getCurrentAccount()).toBe(account);
    expect(mockNavigateDeprecated).toHaveBeenCalledWith(
      RootNames.SingleAddressStack,
      {
        screen: RootNames.SingleAddressHome,
        params: { account, navigationId: expect.any(Number) },
      },
    );
    expect(mockMarkFeatureActivation).toHaveBeenNthCalledWith(
      2,
      'single-address',
      'navigation-dispatched',
      expect.objectContaining({
        cycleId: 17,
        reason: 'navigate_after_state_preset',
      }),
    );
  });

  it('keeps replace navigation synchronous', () => {
    apisSingleHome.navigateToSingleHome(account, { replace: true });

    expect(apisSingleHome.getCurrentAccount()).toBe(account);
    expect(mockResetNavigationOnTopOfHome).toHaveBeenCalledWith(
      RootNames.SingleAddressStack,
      {
        screen: RootNames.SingleAddressHome,
        params: { account, navigationId: expect.any(Number) },
      },
    );
  });

  it.each([false, true])(
    'ignores the old screen cleanup after a new navigation (same address: %s)',
    sameAddress => {
      apisSingleHome.navigateToSingleHome(account);
      const oldNavigationId =
        mockNavigateDeprecated.mock.lastCall?.[1].params.navigationId;
      const importedAccount = sameAddress
        ? account
        : { ...account, address: '0x2222222222222222222222222222222222222222' };

      apisSingleHome.navigateToSingleHome(importedAccount, { replace: true });
      const newNavigationId =
        mockResetNavigationOnTopOfHome.mock.lastCall?.[1].params.navigationId;
      apisSingleHome.clearCurrentAccount(oldNavigationId);

      expect(apisSingleHome.getCurrentAccount()).toBe(importedAccount);
      expect(newNavigationId).toEqual(expect.any(Number));
      expect(newNavigationId).not.toBe(oldNavigationId);

      apisSingleHome.clearCurrentAccount(newNavigationId);
      expect(apisSingleHome.getCurrentAccount()).toBeNull();
    },
  );

  it('does not let an ownerless legacy screen clear the current navigation', () => {
    apisSingleHome.navigateToSingleHome(account);
    apisSingleHome.clearCurrentAccount(undefined);
    expect(apisSingleHome.getCurrentAccount()).toBe(account);
  });

  it('updates cleanup ownership when a mounted route switches account', () => {
    apisSingleHome.navigateToSingleHome(account);
    const oldNavigationId =
      mockNavigateDeprecated.mock.lastCall?.[1].params.navigationId;
    const screen = renderHook(
      ({ navigationId }) => useSingleHomeNavigationCleanup(navigationId),
      { initialProps: { navigationId: oldNavigationId } },
    );
    const nextAccount = {
      ...account,
      address: '0x3333333333333333333333333333333333333333',
    };
    act(() => apisSingleHome.navigateToSingleHome(nextAccount));
    const nextId =
      mockNavigateDeprecated.mock.lastCall?.[1].params.navigationId;

    screen.rerender({ navigationId: nextId });
    expect(apisSingleHome.getCurrentAccount()).toBe(nextAccount);

    screen.unmount();
    expect(apisSingleHome.getCurrentAccount()).toBeNull();
  });

  it('preserves the new mounted route when the replaced route unmounts late', () => {
    apisSingleHome.navigateToSingleHome(account);
    const oldId = mockNavigateDeprecated.mock.lastCall?.[1].params.navigationId;
    const oldScreen = renderHook(() => useSingleHomeNavigationCleanup(oldId));

    act(() => apisSingleHome.navigateToSingleHome(account, { replace: true }));
    const newId =
      mockResetNavigationOnTopOfHome.mock.lastCall?.[1].params.navigationId;
    const newScreen = renderHook(() => useSingleHomeNavigationCleanup(newId));
    oldScreen.unmount();
    expect(apisSingleHome.getCurrentAccount()).toBe(account);

    newScreen.unmount();
    expect(apisSingleHome.getCurrentAccount()).toBeNull();
  });
});

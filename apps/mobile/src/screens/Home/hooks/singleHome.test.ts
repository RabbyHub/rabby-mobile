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
import { apisSingleHome } from './singleHome';

const account = {
  address: '0x1111111111111111111111111111111111111111',
  type: 'Simple Key Pair',
  brandName: 'Simple Key Pair',
} as Account;

describe('single address navigation', () => {
  beforeEach(() => {
    mockNavigateDeprecated.mockClear();
    mockResetNavigationOnTopOfHome.mockClear();
    mockMarkFeatureActivation.mockClear();
    apisSingleHome.clearCurrentAccount();
  });

  it('prepares the account and dispatches navigation synchronously', () => {
    apisSingleHome.navigateToSingleHome(account);

    expect(apisSingleHome.getCurrentAccount()).toBe(account);
    expect(mockNavigateDeprecated).toHaveBeenCalledWith(
      RootNames.SingleAddressStack,
      {
        screen: RootNames.SingleAddressHome,
        params: { account },
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
        params: { account },
      },
    );
  });
});

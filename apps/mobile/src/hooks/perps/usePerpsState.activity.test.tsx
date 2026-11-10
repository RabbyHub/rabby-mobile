import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import type { Account } from '@/core/startupServices/preference';
import { createStoreActivityScope } from '@/core/state/storeActivity';
import { StoreActivityProvider } from '@/hooks/storeActivity/StoreActivityProvider';
import { perpsStore } from './usePerpsStore';
import { usePerpsState } from './usePerpsState';

// Component contract: retain the real hook, activity scope and Zustand
// publication. Signing/runtime/network orchestration is outside this claim.
jest.mock('@/constant', () => ({ INTERNAL_REQUEST_SESSION: {} }));
jest.mock('@/core/apis/keyring', () => ({ apisKeyring: {} }));
jest.mock('@/core/apis/sendRequest', () => ({ sendRequest: jest.fn() }));
jest.mock('@/core/apis/perps', () => ({ apisPerps: {} }));
jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));
jest.mock('@/utils/perps', () => ({ formatSpotState: jest.fn() }));
jest.mock('@/utils/walletUnlock', () => ({
  ensureWalletUnlockedForAction: jest.fn(),
}));
jest.mock('../useMiniSignTypedData', () => ({ miniSignTypedData: jest.fn() }));
jest.mock('./showToast', () => ({ showToast: jest.fn() }));
jest.mock('./funding/perpsWithdraw', () => ({
  executePerpsWithdraw: jest.fn(),
}));
jest.mock('./actions/perpsActionApproval', () => ({
  ensurePerpsActionApproval: jest.fn(),
}));
jest.mock('./actions/setAgentUnifiedAccount', () => ({
  setPerpsAgentUnifiedAccount: jest.fn(),
}));
jest.mock('./actions/enableUnifiedAccount', () => ({
  executeEnablePerpsUnifiedAccount: jest.fn(),
}));
jest.mock('./runtime/useEnsurePerpsRuntime', () => ({
  useEnsurePerpsRuntime: jest.fn(),
}));
jest.mock('@/screens/Perps/hooks/usePerpsPopupState', () => ({
  usePerpsPopupState: () => [{}, jest.fn()],
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('./usePerpsStore', () => ({
  perpsStore: require('zustand').create(() => ({
    currentPerpsAccount: null,
    accountNeedApproveAgent: false,
    accountNeedApproveBuilderFee: false,
    isInitialized: true,
    isLogin: true,
    hasPermission: true,
    perpFee: 0,
    userFills: [],
    userAccountHistory: [],
    localLoadingHistory: [],
    favoriteMarkets: [],
    openOrders: [],
    currentClearinghouseState: null,
  })),
  usePerpsStore: () => ({}),
}));

describe('usePerpsState opt-in retained publication', () => {
  beforeEach(() => {
    perpsStore.setState({
      currentPerpsAccount: null,
      accountNeedApproveAgent: false,
      accountNeedApproveBuilderFee: false,
      favoriteMarkets: [],
    });
  });

  it('pauses display updates while identity and approval control remain live', () => {
    const scope = createStoreActivityScope({ active: true, label: 'simple' });
    const rendered = jest.fn();
    const { result, unmount } = renderHook(
      () => {
        rendered();
        return usePerpsState({
          pauseInactivePublication: true,
          legacyRuntimeContinuationEnabled: false,
        });
      },
      {
        wrapper: ({ children }) => (
          <StoreActivityProvider scope={scope}>
            {children}
          </StoreActivityProvider>
        ),
      },
    );
    act(() => scope.setActive(false));
    const renderCount = rendered.mock.calls.length;
    act(() => perpsStore.setState({ favoriteMarkets: ['BTC'] }));
    act(() => perpsStore.setState({ favoriteMarkets: ['ETH'] }));
    expect(perpsStore.getState().favoriteMarkets).toEqual(['ETH']);
    expect(result.current.favoriteMarkets).toEqual([]);
    expect(rendered).toHaveBeenCalledTimes(renderCount);

    const account = { address: '0x123', type: 'watch' } as Account;
    act(() =>
      perpsStore.setState({
        currentPerpsAccount: account,
        accountNeedApproveAgent: true,
      }),
    );
    expect(result.current.currentPerpsAccount).toBe(account);
    expect(result.current.accountNeedApproveAgent).toBe(true);
    expect(result.current.favoriteMarkets).toEqual([]);

    const beforeCatchUp = rendered.mock.calls.length;
    act(() => scope.setActive(true));
    expect(result.current.favoriteMarkets).toEqual(['ETH']);
    expect(rendered).toHaveBeenCalledTimes(beforeCatchUp + 1);
    unmount();
    scope.dispose();
  });

  it('preserves the default live subscription inside an inactive scope', () => {
    const scope = createStoreActivityScope({
      active: false,
      label: 'other-caller',
    });
    const { result, unmount } = renderHook(() => usePerpsState(), {
      wrapper: ({ children }) => (
        <StoreActivityProvider scope={scope}>{children}</StoreActivityProvider>
      ),
    });
    act(() => perpsStore.setState({ favoriteMarkets: ['BTC'] }));
    expect(result.current.favoriteMarkets).toEqual(['BTC']);
    unmount();
    scope.dispose();
  });
});

import { act, renderHook } from '@testing-library/react-native';

const mockAccount = {
  address: '0x0000000000000000000000000000000000000001',
  type: 'watch',
};
const createRawPosition = (marginUsed = '20', szi = '1') => ({
  position: {
    coin: 'BTC',
    entryPx: '95',
    leverage: { type: 'isolated', value: 10 },
    liquidationPx: '80',
    marginUsed,
    szi,
  },
});
const mockPerpsState: any = {
  currentClearinghouseState: {
    assetPositions: [createRawPosition()],
    perDexSummaries: { '': { withdrawable: '5' } },
  },
  currentPerpsAccount: mockAccount,
  hasPermission: true,
  isSpotStateReady: true,
  isUserDataReady: true,
  marketDataMap: {
    BTC: {
      dexId: '',
      displayName: 'BTC',
      maintenanceMarginTiers: [
        {
          lowerBound: '0',
          maintenanceDeduction: '0',
          maintenanceMarginRate: '0.05',
          maxLeverage: 20,
        },
      ],
      marginMode: 'normal',
      markPx: '100',
      name: 'BTC',
      onlyIsolated: false,
      pxDecimals: 2,
      quoteAsset: 'USDC',
    },
  },
  spotState: { tokenToAvailableAfterMaintenance: null },
  userAbstraction: 'default',
  userAbstractionReady: true,
};
const mockEnsureApproval = jest.fn();
const mockBuildCommand = jest.fn();
const mockExecute = jest.fn();
const mockShowToast = jest.fn();

jest.mock('@/hooks/perps/actions/actionError', () => ({
  isPerpsActionUserCancelled: () => false,
}));
jest.mock('@/hooks/perps/actions/perpsActionApproval', () => ({
  ensurePerpsActionApproval: (...args: unknown[]) =>
    mockEnsureApproval(...args),
}));
jest.mock('@/hooks/perps/actions/updateIsolatedMargin', () => ({
  buildPerpsUpdateIsolatedMarginCommand: (...args: unknown[]) =>
    mockBuildCommand(...args),
  executePerpsUpdateIsolatedMargin: (...args: unknown[]) =>
    mockExecute(...args),
}));
jest.mock('@/hooks/perps/perpsActionError', () => ({
  judgeIsBuilderFeeNeedApprove: () => false,
  judgeIsUserAgentIsExpired: async () => false,
}));
jest.mock('@/hooks/perps/runtime/perpsRuntimeState', () => ({
  getPerpsRuntimeIdentity: (account: typeof mockAccount) =>
    `${account.address.toLowerCase()}::${String(account.type)}`,
}));
jest.mock('@/hooks/perps/showToast', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));
jest.mock('@/hooks/perps/usePerpsStore', () => {
  const store = (selector: (state: typeof mockPerpsState) => unknown) =>
    selector(mockPerpsState);
  store.getState = () => mockPerpsState;
  return {
    getDexByCoin: jest.fn(() => ''),
    perpsStore: store,
  };
});
jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('zustand/react/shallow', () => ({
  useShallow: (selector: unknown) => selector,
}));
jest.mock('../model/market', () => ({
  buildPerpsProMarketDescriptor: () => ({
    displayPair: 'BTC-USDC',
    sourceTag: null,
  }),
}));

import type { PerpsPositionViewModel } from '../model/position';
import { usePerpsProManageMargin } from './usePerpsProManageMargin';

const position: PerpsPositionViewModel = {
  baseSize: '1',
  coin: 'BTC',
  direction: 'long',
  entryPrice: '95',
  key: 'BTC',
  leverage: 10,
  liquidationPrice: '80',
  margin: '20',
  marginMode: 'isolated',
  marginRatio: '0.1',
  maxLeverage: 20,
  pnl: '5',
  quoteSize: '100',
  roiRatio: '0.25',
  tpslOrders: [],
};

const replaceRawPosition = (marginUsed: string, szi = '1') => {
  mockPerpsState.currentClearinghouseState = {
    ...mockPerpsState.currentClearinghouseState,
    assetPositions: [createRawPosition(marginUsed, szi)],
  };
};

describe('usePerpsProManageMargin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    replaceRawPosition('20');
    mockPerpsState.currentPerpsAccount = mockAccount;
    mockPerpsState.hasPermission = true;
    mockEnsureApproval.mockResolvedValue(undefined);
    mockBuildCommand.mockImplementation(input => ({
      ...input,
      type: 'updateIsolatedMargin',
    }));
    mockExecute.mockResolvedValue({ kind: 'success' });
  });

  it('opens only a live isolated position and derives dynamic range/risk facts', () => {
    const hook = renderHook(() => usePerpsProManageMargin());

    act(() => hook.result.current.open(position));
    expect(hook.result.current.draft).toBe('20');
    expect(hook.result.current.view).toMatchObject({
      displayPair: 'BTC-USDC',
      markPrice: '100',
      quoteAsset: 'USDC',
      range: { max: '25', min: '10.1' },
    });

    act(() => hook.result.current.close());
    act(() => hook.result.current.open({ ...position, marginMode: 'cross' }));
    expect(hook.result.current.editor).toBeNull();
  });

  it('accepts live margin updates until the user takes draft ownership', () => {
    const hook = renderHook(() => usePerpsProManageMargin());
    act(() => hook.result.current.open(position));

    act(() => {
      replaceRawPosition('21');
      hook.rerender({});
    });
    expect(hook.result.current.draft).toBe('21');

    act(() => hook.result.current.beginEditing());
    act(() => {
      replaceRawPosition('22');
      hook.rerender({});
    });
    expect(hook.result.current.draft).toBe('21');
  });

  it('approves, revalidates, submits the latest signed delta command, and closes', async () => {
    const hook = renderHook(() => usePerpsProManageMargin());
    act(() => hook.result.current.open(position));
    act(() => hook.result.current.changeDraft('15'));

    await act(async () => hook.result.current.confirm());

    expect(mockEnsureApproval).toHaveBeenCalledWith(mockAccount);
    expect(mockBuildCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        coin: 'BTC',
        expectedSignedSize: '1',
        targetMargin: '15',
      }),
    );
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.positions.marginUpdated',
      'success',
    );
    expect(hook.result.current.editor).toBeNull();
  });

  it('fails closed when the position fingerprint changes after approval', async () => {
    mockEnsureApproval.mockImplementation(async () => {
      replaceRawPosition('20', '2');
    });
    const hook = renderHook(() => usePerpsProManageMargin());
    act(() => hook.result.current.open(position));
    act(() => hook.result.current.changeDraft('15'));

    await act(async () => hook.result.current.confirm());

    expect(mockExecute).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.positions.marginContextChanged',
      'error',
    );
    expect(hook.result.current.editor).toBeNull();
  });

  it('closes without an action when the live margin reaches the target during approval', async () => {
    mockEnsureApproval.mockImplementation(async () => {
      replaceRawPosition('15');
    });
    const hook = renderHook(() => usePerpsProManageMargin());
    act(() => hook.result.current.open(position));
    act(() => hook.result.current.changeDraft('15'));

    await act(async () => hook.result.current.confirm());

    expect(mockExecute).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.positions.marginUpdated',
      'success',
    );
    expect(hook.result.current.editor).toBeNull();
  });

  it('closes an unknown-outcome editor so the action cannot be replayed', async () => {
    mockExecute.mockResolvedValue({ kind: 'unknownOutcome' });
    const hook = renderHook(() => usePerpsProManageMargin());
    act(() => hook.result.current.open(position));
    act(() => hook.result.current.changeDraft('15'));

    await act(async () => hook.result.current.confirm());

    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.positions.marginUpdateUnknown',
      'error',
    );
    expect(hook.result.current.editor).toBeNull();
  });
});

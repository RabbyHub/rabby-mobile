import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { BorrowActionPopup } from './BorrowActionPopup';
import { TokenAmountInput } from './TokenAmountInput';
import { DirectSignBtn } from '@/components2024/DirectSignBtn';
import type { PopupDetailProps } from '../../type';

const mockOpenDirect = jest.fn().mockResolvedValue([]);
const mockSendRequest = jest.fn();
const mockPrefetch = jest.fn();
const mockRefresh = jest.fn();
let mockAccount = { address: '0x01', type: 'Simple Key Pair', brandName: '' };
const mockReserve = {
  underlyingAsset: '0x02',
  reserve: {
    symbol: 'USDC',
    underlyingAsset: '0x02',
    aTokenAddress: '0x03',
    variableDebtTokenAddress: '0x04',
    decimals: 6,
    formattedPriceInMarketReferenceCurrency: '1',
    borrowCap: '10000',
    totalDebt: '100',
  },
};
const mockReserves = [mockReserve.reserve];
const mockPool = { poolBundle: {} };
const mockChain = { id: 1, serverId: 'eth' };
const mockMarket = { chainId: 1, market: 'test' };
const mockScene = () => ({ finalSceneCurrentAccount: mockAccount });

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {}, colors2024: {} }),
}));
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetScrollView: 'ScrollView',
}));
jest.mock('@debank/common', () => ({ CHAINS_ENUM: { ETH: 'ETH' } }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('@/components/AutoLockView', () => 'AutoLockView');
jest.mock('@/components/Typography', () => ({ Text: 'Text' }));
jest.mock('@/screens/TokenDetail/util', () => ({
  formatAmountValueKMB: String,
}));
jest.mock('./TokenAmountInput', () => ({
  TokenAmountInput: 'TokenAmountInput',
}));
jest.mock('./BorrowActionOverView', () => 'BorrowActionOverView');
jest.mock('../Tips/BorrowToCapTip', () => 'BorrowToCapTip');
jest.mock('../../hooks', () => ({
  useLendingSummary: () => ({
    formattedPoolReservesAndIncentives: mockReserves,
  }),
  usePoolDataProviderContract: () => ({ pools: mockPool }),
  useSelectedMarket: () => ({
    chainInfo: mockChain,
    selectedMarketData: mockMarket,
  }),
  useRefreshHistoryId: () => ({ refresh: mockRefresh }),
}));
jest.mock('../../poolService', () => ({
  buildBorrowTx: jest.fn().mockResolvedValue({ to: '0x02', data: '0x' }),
  optimizedPath: () => false,
}));
jest.mock('../../utils/borrow', () => ({
  assetCanBeBorrowedByUser: () => true,
}));
jest.mock('@/components2024/DirectSignBtn', () => ({
  DirectSignBtn: 'DirectSignBtn',
}));
jest.mock('@/hooks/accountsSwitcher', () => ({
  useSceneAccountInfo: () => mockScene(),
}));
jest.mock('@/screens/Bridge/components/BridgeShowMore', () => ({
  DirectSignGasInfo: 'GasInfo',
}));
jest.mock('@/utils/account', () => ({
  isAccountSupportMiniApproval: () => true,
}));
jest.mock('@/components2024/Toast', () => ({
  toast: { info: jest.fn(), error: jest.fn(), success: jest.fn() },
}));
jest.mock('@/components2024/CheckBox', () => ({ CheckBoxRect: 'CheckBox' }));
jest.mock('@/hooks/useSigner', () => ({
  useMiniSigner: () => ({ openDirect: mockOpenDirect, prefetch: mockPrefetch }),
}));
jest.mock('@/core/serviceApi/transactionHistory', () => ({
  transactionHistoryServiceApi: {},
}));
jest.mock('@/constant', () => ({
  APP_VERSIONS: {},
  INTERNAL_REQUEST_SESSION: {},
}));
jest.mock('@/core/apis', () => ({
  apiProvider: {
    sendRequest: (...args: unknown[]) => mockSendRequest(...args),
  },
}));
jest.mock('@/components2024/Button', () => ({ Button: 'Button' }));
jest.mock('@/components2024/MiniSignV2/state/SignatureManager', () => ({
  MINI_SIGN_ERROR: {
    PREFETCH_FAILURE: 'PREFETCH_FAILURE',
    USER_CANCELLED: 'USER_CANCELLED',
  },
}));
jest.mock('@/components2024/MiniSignV2/state/SignatureInstanceContext', () => ({
  SignatureInstanceProvider: ({ children }: React.PropsWithChildren) =>
    children,
}));
jest.mock('@/components2024/MiniSignV2/state/useSignatureStore', () => ({
  useSignatureStoreOf: () => ({}),
}));
jest.mock('@/utils/number', () => ({ formatTokenAmount: String }));
jest.mock('@/utils/stats', () => ({ stats: { report: jest.fn() } }));

const fixture = {
  reserve: mockReserve,
  userSummary: {
    totalLiquidityUSD: '1000',
    availableBorrowsUSD: '100',
    totalCollateralUSD: '1000',
    totalBorrowsUSD: '10',
    currentLiquidationThreshold: '0.8',
  },
} as unknown as PopupDetailProps;

describe('Borrow authentication form binding (component unit)', () => {
  beforeEach(() => {
    mockOpenDirect.mockClear();
    mockSendRequest.mockReset();
    mockAccount = { address: '0x01', type: 'Simple Key Pair', brandName: '' };
  });

  async function ready() {
    const view = render(<BorrowActionPopup {...fixture} />);
    act(() => view.UNSAFE_getByType(TokenAmountInput).props.onChange('1'));
    await waitFor(() =>
      expect(view.UNSAFE_getByType(DirectSignBtn).props.disabled).toBeFalsy(),
    );
    return { view, attempt: view.UNSAFE_getByType(DirectSignBtn).props };
  }

  it('keeps the amount locked while prefetch failure falls back to full signing', async () => {
    let finish!: () => void;
    mockSendRequest.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        }),
    );
    mockOpenDirect.mockRejectedValueOnce('PREFETCH_FAILURE');
    const { view, attempt } = await ready();
    let submission!: Promise<unknown>;
    await act(async () => {
      attempt.onBeforeAuth();
      submission = attempt.onFinished();
    });
    await waitFor(() => expect(mockSendRequest).toHaveBeenCalledTimes(1));
    try {
      act(() => view.UNSAFE_getByType(TokenAmountInput).props.onChange('2'));
      expect(view.UNSAFE_getByType(TokenAmountInput).props.value).toBe('1');
      expect(view.UNSAFE_getByType(DirectSignBtn).props.loading).toBe(true);
    } finally {
      await act(async () => {
        finish();
        await submission;
      });
    }
  });

  it('blocks native input and Max during auth, then allows one unchanged submission', async () => {
    const { view, attempt } = await ready();
    act(() => attempt.onBeforeAuth());
    act(() => {
      const input = view.UNSAFE_getByType(TokenAmountInput).props;
      input.onChange('123456');
      input.handleClickMaxButton();
    });
    expect(view.UNSAFE_getByType(TokenAmountInput).props.value).toBe('1');
    act(() => attempt.onAuthModalDismiss());
    await act(async () => {
      await attempt.onFinished();
      await attempt.onFinished();
    });
    expect(mockOpenDirect).toHaveBeenCalledTimes(1);
  });

  it('does not submit a cancelled authentication', async () => {
    const { attempt } = await ready();
    act(() => {
      attempt.onBeforeAuth();
      attempt.onCancel();
      attempt.onAuthModalDismiss();
    });
    await act(async () => {
      await attempt.onFinished();
    });
    expect(mockOpenDirect).not.toHaveBeenCalled();
  });

  it('rejects a late native input between dismiss and finish before rerender', async () => {
    const { view, attempt } = await ready();
    const input = view.UNSAFE_getByType(TokenAmountInput).props;
    act(() => attempt.onBeforeAuth());
    await act(async () => {
      attempt.onAuthModalDismiss();
      input.onChange('2');
      await attempt.onFinished();
    });
    expect(mockOpenDirect).not.toHaveBeenCalled();
  });

  it('does not sign the old account after auth dismisses and the account changes', async () => {
    const view = render(<BorrowActionPopup {...fixture} />);
    act(() => view.UNSAFE_getByType(TokenAmountInput).props.onChange('1'));
    await waitFor(() =>
      expect(view.UNSAFE_getByType(DirectSignBtn).props.disabled).toBeFalsy(),
    );
    // Retain the callbacks captured by the actual auth attempt, not the rerender.
    const attempt = view.UNSAFE_getByType(DirectSignBtn).props;
    act(() => attempt.onBeforeAuth?.());
    act(() => attempt.onAuthModalDismiss?.());
    mockAccount = { ...mockAccount, address: '0x05' };
    view.rerender(<BorrowActionPopup {...fixture} />);
    await act(async () => {
      await attempt.onFinished();
    });
    expect(mockOpenDirect).not.toHaveBeenCalled();
  });
});

import { act, renderHook } from '@testing-library/react-native';

const mockGetState = jest.fn();
const mockShowToast = jest.fn();
const mockGetSkipLimitConfirmation = jest.fn(async () => false);

jest.mock('@/core/apis/perps', () => ({ apisPerps: {} }));
jest.mock('@/core/serviceApi/perps', () => ({
  perpsServiceApi: {
    getSkipPerpsProLimitCloseConfirmation: () => mockGetSkipLimitConfirmation(),
    setSkipPerpsProLimitCloseConfirmation: jest.fn(),
  },
}));
jest.mock('@/hooks/perps/actions/actionError', () => ({
  isPerpsActionUserCancelled: () => false,
}));
jest.mock('@/hooks/perps/actions/perpsActionApproval', () => ({
  ensurePerpsActionApproval: jest.fn(),
}));
jest.mock('@/hooks/perps/perpsActionError', () => ({
  judgeIsBuilderFeeNeedApprove: () => false,
  judgeIsUserAgentIsExpired: async () => false,
}));
jest.mock('@/hooks/perps/showToast', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));
jest.mock('@/hooks/perps/usePerpsStore', () => ({
  fetchClearinghouseStateHttp: jest.fn(),
  fetchPositionOpenOrdersHttp: jest.fn(),
  getDexByCoin: jest.fn(() => ''),
  perpsStore: { getState: () => mockGetState() },
}));
jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../model/market', () => ({
  buildPerpsProMarketDescriptor: () => ({
    displayBase: 'BTC',
    displayPair: 'BTCUSDC',
    sourceTag: null,
  }),
}));

import type { PerpsPositionViewModel } from '../model/position';
import type { PerpsProCloseDraft } from '../model/positionAction';
import { usePerpsProPositionActions } from './usePerpsProPositionActions';

const account = {
  address: '0x1111111111111111111111111111111111111111',
  type: 'PrivateKeyring',
};
const position = {
  baseSize: '0.1',
  coin: 'BTC',
  direction: 'long',
  key: 'BTC',
} as PerpsPositionViewModel;
const draft = (size: string): PerpsProCloseDraft => ({
  inputSource: 'slider',
  limitPrice: null,
  midPrice: '100',
  orderType: 'market',
  percent: 50,
  referencePrice: '100',
  size,
});

describe('usePerpsProPositionActions close validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetState.mockReturnValue({
      currentPerpsAccount: account,
      marketDataMap: {
        BTC: {
          markPx: '100',
          midPx: '100',
          pxDecimals: 2,
          quoteAsset: 'USDC',
          szDecimals: 4,
        },
      },
    });
  });

  it('stops a partial close below $10 before opening review', async () => {
    const hook = renderHook(() =>
      usePerpsProPositionActions({
        accountIdentity: 'account-a',
        leveragePending: false,
        updateLeverageRequest: jest.fn(),
      }),
    );

    await act(async () => {
      hook.result.current.openCloseEditor(position);
      await Promise.resolve();
    });
    act(() => hook.result.current.reviewClose(draft('0.05')));

    expect(hook.result.current.closeReview).toBeNull();
    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.positions.minimumCloseAmount',
      'error',
    );
  });

  it('keeps the below-$10 exception for a full close', async () => {
    const hook = renderHook(() =>
      usePerpsProPositionActions({
        accountIdentity: 'account-a',
        leveragePending: false,
        updateLeverageRequest: jest.fn(),
      }),
    );

    await act(async () => {
      hook.result.current.openCloseEditor(position);
      await Promise.resolve();
    });
    act(() => hook.result.current.reviewClose(draft('0.1')));

    expect(hook.result.current.closeReview).toMatchObject({ size: '0.1' });
    expect(mockShowToast).not.toHaveBeenCalled();
  });
});

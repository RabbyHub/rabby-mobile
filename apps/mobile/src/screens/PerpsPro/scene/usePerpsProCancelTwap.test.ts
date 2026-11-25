import { act, renderHook } from '@testing-library/react-native';
import type { PerpsTwapRecord } from '@/hooks/perps/twap/types';

const mockUnlock = jest.fn(async () => true);
const mockApproval = jest.fn(async () => {});
const mockSubmit = jest.fn(async (..._args: unknown[]) => ({
  kind: 'requestFailed',
  error: 'offline',
}));
const mockToast = jest.fn();
const mockAccount = {
  address: '0x00000000000000000000000000000000000000aa',
  type: 'SimpleKeyring',
};
let mockGeneration = 1;
let mockUnlocked = true;
let mockOrder: PerpsTwapRecord;
jest.mock('@/utils/walletUnlock', () => ({
  ensureWalletUnlockedForAction: () => mockUnlock(),
}));
jest.mock('@/core/apis/lock', () => ({ isUnlocked: () => mockUnlocked }));
jest.mock('@/core/apis/perps', () => ({
  apisPerps: {
    getPerpsSDK: () => ({
      exchange: { cancelTwapOrderWithOutcome: mockSubmit },
    }),
  },
}));
jest.mock('@/hooks/perps/actions/perpsActionApproval', () => ({
  ensurePerpsActionApproval: () => mockApproval(),
}));
jest.mock('@/hooks/perps/showToast', () => ({
  showToast: (...args: unknown[]) => mockToast(...args),
}));
jest.mock('@/hooks/perps/usePerpsStore', () => ({
  perpsStore: { getState: () => ({ currentPerpsAccount: mockAccount }) },
  getPerpsAccountRuntimeContext: () => ({
    account: mockAccount,
    generation: mockGeneration,
    isInitialized: true,
  }),
  hasCurrentPerpPermission: () => true,
}));
jest.mock('@/hooks/perps/runtime/perpsRuntimeState', () => ({
  ...jest.requireActual('@/hooks/perps/runtime/perpsRuntimeState'),
  getPerpsRuntimeSnapshot: () => ({
    status: 'ready',
    generation: 1,
    identity: `${mockAccount.address}::${mockAccount.type}`,
  }),
}));
jest.mock('@/hooks/perps/twap/usePerpsTwapStore', () => ({
  getPerpsTwapAccount: () => ({
    records: { [mockOrder.key]: mockOrder },
    sources: { active: { ready: true } },
  }),
  queuePerpsTwapReceipt: jest.fn(),
}));
jest.mock('@/hooks/perps/twap/usePerpsTwapSubscriptions', () => ({
  refreshPerpsTwaps: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { usePerpsProCancelTwap } from './usePerpsProCancelTwap';

beforeEach(() => {
  jest.clearAllMocks();
  mockGeneration = 1;
  mockUnlocked = true;
  mockOrder = {
    key: 'BTC:7',
    twapId: 7,
    active: true,
    status: 'activated',
    endedAt: null,
    eventTime: 1,
    state: {
      coin: 'BTC',
      user: mockAccount.address,
      side: 'B',
      sz: '1',
      executedSz: '0',
      executedNtl: '0',
      minutes: 30,
      randomize: false,
      reduceOnly: false,
      timestamp: 1,
    },
  };
});

it('unlocks once before presenting End, then guards duplicate submission while pending', async () => {
  let unlock!: (value: boolean) => void;
  mockUnlock.mockReturnValueOnce(
    new Promise(resolve => {
      unlock = resolve;
    }),
  );
  const hook = renderHook(() => usePerpsProCancelTwap('account-a', true));
  act(() => {
    void hook.result.current.request(mockOrder);
    void hook.result.current.request(mockOrder);
  });
  expect(mockUnlock).toHaveBeenCalledTimes(1);
  expect(hook.result.current.command).toBeNull();
  await act(async () => {
    unlock(true);
  });
  expect(hook.result.current.command?.twapId).toBe(7);
  let settle!: (value: { kind: string; error: string }) => void;
  mockSubmit.mockReturnValueOnce(
    new Promise(resolve => {
      settle = resolve;
    }),
  );
  await act(async () => {
    void hook.result.current.confirm();
    void hook.result.current.confirm();
  });
  expect(hook.result.current.pending).toBe(true);
  expect(mockSubmit).toHaveBeenCalledTimes(1);
  act(() => hook.result.current.close());
  expect(hook.result.current.command).not.toBeNull();
  await act(async () => {
    settle({ kind: 'requestFailed', error: 'offline' });
  });
  expect(hook.result.current.command).toBeNull();
  expect(hook.result.current.pending).toBe(false);
});

it.each(['cancel', 'account', 'ended', 'inactive', 'unmount'] as const)(
  'does not resurrect End after %s during unlock',
  async reason => {
    let unlock!: (value: boolean) => void;
    mockUnlock.mockReturnValueOnce(
      new Promise(resolve => {
        unlock = resolve;
      }),
    );
    const hook = renderHook(
      ({ active }) => usePerpsProCancelTwap('account-a', active),
      { initialProps: { active: true } },
    );
    act(() => {
      void hook.result.current.request(mockOrder);
    });
    if (reason === 'account') mockGeneration++;
    if (reason === 'ended') mockOrder = { ...mockOrder, active: false };
    if (reason === 'inactive') hook.rerender({ active: false });
    if (reason === 'unmount') hook.unmount();
    await act(async () => {
      unlock(reason !== 'cancel');
    });
    expect(hook.result.current.command).toBeNull();
    expect(mockSubmit).not.toHaveBeenCalled();
  },
);

it('invalidates End on relock without starting an approval or another password prompt', async () => {
  const hook = renderHook(() => usePerpsProCancelTwap('account-a', true));
  await act(async () => {
    await hook.result.current.request(mockOrder);
  });
  mockUnlocked = false;
  await act(async () => {
    await hook.result.current.confirm();
  });
  expect(hook.result.current.command).toBeNull();
  expect(mockUnlock).toHaveBeenCalledTimes(1);
  expect(mockApproval).not.toHaveBeenCalled();
  expect(mockSubmit).not.toHaveBeenCalled();
});

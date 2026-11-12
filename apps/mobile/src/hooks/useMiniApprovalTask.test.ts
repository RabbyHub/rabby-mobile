import { act, renderHook } from '@testing-library/react-native';

const mockCancel = jest.fn(async () => undefined);
const mockSendTransaction = jest.fn();

jest.mock('@/core/apis/onekey', () => ({
  cancel: () => mockCancel(),
}));
jest.mock('@/utils/sendTransaction', () => ({
  FailedCode: { UserRejected: 'UserRejected' },
  sendTransaction: (...args: any[]) => mockSendTransaction(...args),
}));
jest.mock('@/utils/errorTxRetry', () => ({
  getRetryTxRecommendNonce: jest.fn(),
  getRetryTxType: jest.fn(),
  retryTxReset: jest.fn(),
  setRetryTxRecommendNonce: jest.fn(async () => undefined),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
jest.mock('@rabby-wallet/keyring-utils', () => ({
  KEYRING_TYPE: { OneKeyKeyring: 'Onekey Hardware' },
}));

import {
  releaseOneKeyMiniSign,
  useClearMiniApprovalTask,
  useMiniApprovalTask,
} from './useMiniApprovalTask';

const txItem = (type: string) =>
  ({
    tx: { from: '0x1', chainId: 1, nonce: '0x0' },
    options: { account: { type, address: '0x1' } },
    status: 'idle',
  } as any);

function pendingSend() {
  let reject!: (e: any) => void;
  let resolve!: (v: any) => void;
  mockSendTransaction.mockImplementation(
    () =>
      new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      }),
  );
  return {
    reject: (e: any) => reject(e),
    resolve: (v: any) => resolve(v),
  };
}

const flush = () => act(() => new Promise(r => setImmediate(r)));

describe('useMiniApprovalTask OneKey release', () => {
  beforeEach(() => {
    mockCancel.mockClear();
    mockSendTransaction.mockReset();
    releaseOneKeyMiniSign();
    mockCancel.mockClear();
  });

  it('cancels the OneKey request when the task is cleared while signing', async () => {
    pendingSend();
    const { result } = renderHook(() => useMiniApprovalTask({}));
    act(() => result.current.init([txItem('Onekey Hardware')]));
    act(() => {
      result.current.start().catch(() => undefined);
    });
    await flush();
    expect(mockSendTransaction).toHaveBeenCalledTimes(1);

    act(() => result.current.clear());
    expect(mockCancel).toHaveBeenCalledTimes(1);

    // A second clear or unmount does not cancel again.
    releaseOneKeyMiniSign();
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it('cancels through the global clear used on route change', async () => {
    pendingSend();
    const { result } = renderHook(() => ({
      task: useMiniApprovalTask({}),
      global: useClearMiniApprovalTask(),
    }));
    act(() => result.current.task.init([txItem('Onekey Hardware')]));
    act(() => {
      result.current.task.start().catch(() => undefined);
    });
    await flush();

    act(() => result.current.global.clear());
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it('does not cancel after the device has answered', async () => {
    const send = pendingSend();
    const { result } = renderHook(() => useMiniApprovalTask({}));
    act(() => result.current.init([txItem('Onekey Hardware')]));
    act(() => {
      result.current.start().catch(() => undefined);
    });
    await flush();
    send.reject(Object.assign(new Error('rejected'), { name: 'UserRejected' }));
    await flush();

    act(() => result.current.clear());
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('does not touch the SDK for other keyrings', async () => {
    pendingSend();
    const { result } = renderHook(() => useMiniApprovalTask({}));
    act(() => result.current.init([txItem('Ledger Hardware')]));
    act(() => {
      result.current.start().catch(() => undefined);
    });
    await flush();

    act(() => result.current.clear());
    expect(mockCancel).not.toHaveBeenCalled();
  });
});

import { act, renderHook } from '@testing-library/react-native';
import { UserAbstractionResp } from '@rabby-wallet/hyperliquid-sdk';

const mockBuildCommand = jest.fn();
const mockExecuteTransfer = jest.fn();
const mockShowToast = jest.fn();
const mockGetState = jest.fn();

jest.mock('@/hooks/perps/funding/perpsTransfer', () => ({
  buildPerpsSpotToPerpsTransferCommand: (...args: unknown[]) =>
    mockBuildCommand(...args),
  executePerpsSpotToPerpsTransfer: (...args: unknown[]) =>
    mockExecuteTransfer(...args),
}));
jest.mock('@/hooks/perps/showToast', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));
jest.mock('@/hooks/perps/usePerpsStore', () => ({
  getPerpsAccountRuntimeContext: () => ({
    account: mockGetState().currentPerpsAccount,
    generation: 5,
  }),
  isPerpsUserAbstractionReadyForAccount: (state: {
    currentPerpsAccount?: { address?: string };
    userAbstractionOwnerAddress?: string | null;
    userAbstractionReady?: boolean;
  }) =>
    !!state.userAbstractionReady &&
    state.userAbstractionOwnerAddress?.toLowerCase() ===
      state.currentPerpsAccount?.address?.toLowerCase(),
  perpsStore: { getState: () => mockGetState() },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import type { PerpsAccountAssetRow } from '../model/account';
import { usePerpsProTransfer } from './usePerpsProTransfer';

const account = {
  address: '0x1111111111111111111111111111111111111111',
  type: 'PrivateKeyring',
};
const asset = {
  action: 'transfer',
  available: '10',
  coin: 'USDC',
  fullName: 'USD Coin',
  key: 'spot:USDC',
  ledger: 'spot',
  total: '10',
  usdValue: '10',
} satisfies PerpsAccountAssetRow;

describe('usePerpsProTransfer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetState.mockReturnValue({
      currentPerpsAccount: account,
      userAbstractionOwnerAddress: account.address,
      userAbstraction: UserAbstractionResp.default,
      userAbstractionReady: true,
    });
    mockBuildCommand.mockReturnValue({ type: 'command' });
  });

  it('uses the exact Standard eligibility and rejects stale or malformed entry facts', () => {
    const hook = renderHook(() => usePerpsProTransfer('account-a'));

    mockGetState.mockReturnValue({
      currentPerpsAccount: account,
      userAbstractionOwnerAddress: account.address,
      userAbstraction: UserAbstractionResp.disabled,
      userAbstractionReady: true,
    });
    act(() => hook.result.current.open(asset));
    expect(hook.result.current.editor).not.toBeNull();

    act(() => hook.result.current.close());
    mockGetState.mockReturnValue({
      currentPerpsAccount: account,
      userAbstractionOwnerAddress: account.address,
      userAbstraction: UserAbstractionResp.dexAbstraction,
      userAbstractionReady: true,
    });
    act(() => hook.result.current.open(asset));
    expect(hook.result.current.editor).toBeNull();

    mockGetState.mockReturnValue({
      currentPerpsAccount: account,
      userAbstractionOwnerAddress: account.address,
      userAbstraction: UserAbstractionResp.default,
      userAbstractionReady: false,
    });
    act(() => hook.result.current.open(asset));
    expect(hook.result.current.editor).toBeNull();

    mockGetState.mockReturnValue({
      currentPerpsAccount: account,
      userAbstractionOwnerAddress: account.address,
      userAbstraction: UserAbstractionResp.default,
      userAbstractionReady: true,
    });
    act(() => hook.result.current.open({ ...asset, ledger: 'perps' }));
    expect(hook.result.current.editor).toBeNull();

    mockGetState.mockReturnValue({
      currentPerpsAccount: account,
      userAbstractionOwnerAddress: '0x2222222222222222222222222222222222222222',
      userAbstraction: UserAbstractionResp.default,
      userAbstractionReady: true,
    });
    act(() => hook.result.current.open(asset));
    expect(hook.result.current.editor).toBeNull();
    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.account.transferContextChanged',
      'error',
    );
  });

  it('opens only from an eligible standard-account asset and closes on account switch', () => {
    const hook = renderHook(({ identity }) => usePerpsProTransfer(identity), {
      initialProps: { identity: 'account-a' },
    });

    act(() => hook.result.current.open(asset));
    expect(hook.result.current.editor).toMatchObject({
      account,
      accountRuntimeGeneration: 5,
      available: '10',
    });

    hook.rerender({ identity: 'account-b' });
    expect(hook.result.current.editor).toBeNull();
  });

  it('keeps the sheet open on request failure and uses only the approved Toast', async () => {
    mockExecuteTransfer.mockResolvedValue({
      failureReason: 'requestFailed',
      kind: 'failed',
    });
    const hook = renderHook(() => usePerpsProTransfer('account-a'));
    act(() => hook.result.current.open(asset));

    await act(async () => {
      await hook.result.current.confirm('2');
    });

    expect(mockBuildCommand).toHaveBeenCalledWith({
      account: expect.objectContaining(account),
      accountRuntimeGeneration: 5,
      amount: '2',
      available: '10',
    });
    expect(hook.result.current.editor).not.toBeNull();
    expect(hook.result.current.pending).toBe(false);
    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.account.transferFailed',
      'error',
    );
  });

  it('closes a stale command with context Toast and suppresses cancellation Toast', async () => {
    const hook = renderHook(() => usePerpsProTransfer('account-a'));
    act(() => hook.result.current.open(asset));
    mockExecuteTransfer.mockResolvedValueOnce({ kind: 'staleContext' });
    await act(async () => {
      await hook.result.current.confirm('2');
    });
    expect(hook.result.current.editor).toBeNull();
    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.account.transferContextChanged',
      'error',
    );

    mockShowToast.mockClear();
    act(() => hook.result.current.open(asset));
    mockExecuteTransfer.mockResolvedValueOnce({
      failureReason: 'userCancelled',
      kind: 'failed',
    });
    await act(async () => {
      await hook.result.current.confirm('2');
    });
    expect(hook.result.current.editor).not.toBeNull();
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it('locks duplicate confirms while the signed request is pending', async () => {
    let resolveRequest: ((value: { kind: 'success' }) => void) | undefined;
    mockExecuteTransfer.mockReturnValue(
      new Promise(resolve => {
        resolveRequest = resolve;
      }),
    );
    const hook = renderHook(() => usePerpsProTransfer('account-a'));
    act(() => hook.result.current.open(asset));

    let firstRequest: Promise<void> | undefined;
    act(() => {
      firstRequest = hook.result.current.confirm('2');
    });
    expect(hook.result.current.pending).toBe(true);
    await act(async () => {
      await hook.result.current.confirm('2');
    });
    expect(mockExecuteTransfer).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRequest?.({ kind: 'success' });
      await firstRequest;
    });
    expect(hook.result.current.pending).toBe(false);
    expect(hook.result.current.editor).toBeNull();
  });
});

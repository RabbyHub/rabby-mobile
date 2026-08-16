import type { Account } from '@/core/startupServices/preference';
import { PerpsActionUserCancelledError } from '@/hooks/perps/actions/actionError';
import { UserAbstractionResp } from '@rabby-wallet/hyperliquid-sdk';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';

jest.mock('@/core/apis/perps', () => ({
  apisPerps: { getPerpsSDK: jest.fn() },
}));
jest.mock('@/hooks/perps/usePerpsStore', () => ({
  fetchClearinghouseStateHttp: jest.fn(),
  fetchSpotStateHttp: jest.fn(),
  perpsStore: { getState: jest.fn() },
}));
jest.mock('./signPerpsMasterTypedData', () => ({
  signPerpsMasterTypedData: jest.fn(),
}));

import {
  buildPerpsSpotToPerpsTransferCommand,
  executePerpsSpotToPerpsTransfer,
  type PerpsSpotToPerpsTransferDependencies,
} from './perpsTransfer';

const ACCOUNT = {
  address: '0x1111111111111111111111111111111111111111',
  brandName: 'Rabby',
  type: KEYRING_CLASS.PRIVATE_KEY,
} as Account;
const OTHER_ACCOUNT = {
  ...ACCOUNT,
  address: '0x2222222222222222222222222222222222222222',
} as Account;
const VALID_SIGNATURE = `0x${'11'.repeat(65)}`;

const makeDependencies = () => {
  let accountRuntimeGeneration = 1;
  let currentAccount: Account | null = ACCOUNT;
  let available = '10';
  let remoteUserAbstraction: unknown = UserAbstractionResp.default;
  let userAbstraction: unknown = UserAbstractionResp.default;
  let userAbstractionReady = true;
  const dependencies: PerpsSpotToPerpsTransferDependencies = {
    getAccountRuntimeGeneration: () => accountRuntimeGeneration,
    getCurrentAccount: () => currentAccount,
    getRemoteUserAbstraction: jest.fn(async () => remoteUserAbstraction),
    getSpotUsdcAvailable: () => available,
    getUserAbstraction: () => userAbstraction,
    getUserAbstractionReady: () => userAbstractionReady,
    prepareSendAsset: jest.fn(() => ({
      message: { type: 'sendAsset' },
      nonce: 7,
    })),
    refreshPerps: jest.fn(async () => undefined),
    refreshSpot: jest.fn(async () => undefined),
    reconcileRemoteUserAbstraction: jest.fn(({ userAbstraction: next }) => {
      userAbstraction = next;
      userAbstractionReady =
        next === UserAbstractionResp.default ||
        next === UserAbstractionResp.disabled ||
        next === UserAbstractionResp.unifiedAccount ||
        next === UserAbstractionResp.portfolioMargin ||
        next === UserAbstractionResp.dexAbstraction;
    }),
    sendSendAsset: jest.fn(async () => ({ status: 'ok' })),
    sign: jest.fn(async () => VALID_SIGNATURE),
  };
  return {
    dependencies,
    setAccountRuntimeGeneration: (next: number) => {
      accountRuntimeGeneration = next;
    },
    setAvailable: (next: string) => {
      available = next;
    },
    setCurrentAccount: (next: Account | null) => {
      currentAccount = next;
    },
    setRemoteUserAbstraction: (next: unknown) => {
      remoteUserAbstraction = next;
    },
    setUserAbstraction: (next: unknown) => {
      userAbstraction = next;
    },
    setUserAbstractionReady: (next: boolean) => {
      userAbstractionReady = next;
    },
  };
};

describe('Perps Spot to Perps transfer', () => {
  it('freezes a validated Spot USDC transfer command', () => {
    const command = buildPerpsSpotToPerpsTransferCommand({
      account: ACCOUNT,
      accountRuntimeGeneration: 1,
      amount: '2.50',
      available: '10',
    });

    expect(command).toEqual({
      account: {
        address: ACCOUNT.address,
        brandName: ACCOUNT.brandName,
        type: ACCOUNT.type,
      },
      accountRuntimeGeneration: 1,
      amount: '2.5',
      destinationDex: '',
      expectedAvailable: '10',
      sourceDex: 'spot',
      token: 'USDC',
      type: 'spotToPerpsTransfer',
    });
    expect(Object.isFrozen(command)).toBe(true);
    expect(Object.isFrozen(command.account)).toBe(true);
    expect(() =>
      buildPerpsSpotToPerpsTransferCommand({
        account: ACCOUNT,
        accountRuntimeGeneration: 1,
        amount: '10.01',
        available: '10',
      }),
    ).toThrow('Invalid Spot USDC transfer amount');
  });

  it('prepares, signs with the frozen master account, sends, and refreshes both ledgers', async () => {
    const { dependencies } = makeDependencies();
    const command = buildPerpsSpotToPerpsTransferCommand({
      account: ACCOUNT,
      accountRuntimeGeneration: 1,
      amount: '2.5',
      available: '10',
    });

    await expect(
      executePerpsSpotToPerpsTransfer(command, dependencies),
    ).resolves.toEqual({ kind: 'success', refreshError: undefined });
    expect(dependencies.prepareSendAsset).toHaveBeenCalledWith({
      amount: '2.5',
      destination: ACCOUNT.address,
      destinationDex: '',
      sourceDex: 'spot',
      token: command.token,
    });
    expect(dependencies.sign).toHaveBeenCalledWith(
      expect.objectContaining({ nonce: 7 }),
      command.account,
    );
    expect(dependencies.sendSendAsset).toHaveBeenCalledWith({
      action: { type: 'sendAsset' },
      nonce: 7,
      signature: VALID_SIGNATURE,
    });
    expect(dependencies.refreshSpot).toHaveBeenCalledWith(ACCOUNT.address);
    expect(dependencies.refreshPerps).toHaveBeenCalledWith(ACCOUNT.address);
    expect(dependencies.getRemoteUserAbstraction).toHaveBeenCalledTimes(2);
  });

  it('fails closed before signing when account, readiness, mode, or balance is stale', async () => {
    const context = makeDependencies();
    const command = buildPerpsSpotToPerpsTransferCommand({
      account: ACCOUNT,
      accountRuntimeGeneration: 1,
      amount: '2.5',
      available: '10',
    });

    context.setCurrentAccount(OTHER_ACCOUNT);
    await expect(
      executePerpsSpotToPerpsTransfer(command, context.dependencies),
    ).resolves.toEqual({ kind: 'staleContext' });
    context.setCurrentAccount(ACCOUNT);
    context.setUserAbstractionReady(false);
    await expect(
      executePerpsSpotToPerpsTransfer(command, context.dependencies),
    ).resolves.toEqual({ kind: 'staleContext' });
    context.setUserAbstractionReady(true);
    context.setUserAbstraction(UserAbstractionResp.unifiedAccount);
    await expect(
      executePerpsSpotToPerpsTransfer(command, context.dependencies),
    ).resolves.toEqual({ kind: 'staleContext' });
    context.setUserAbstraction(UserAbstractionResp.default);
    context.setAvailable('2');
    await expect(
      executePerpsSpotToPerpsTransfer(command, context.dependencies),
    ).resolves.toEqual({ kind: 'staleContext' });
    expect(context.dependencies.prepareSendAsset).not.toHaveBeenCalled();
    expect(context.dependencies.sign).not.toHaveBeenCalled();
  });

  it('allows explicit Standard disabled mode and rejects legacy DEX abstraction', async () => {
    const standard = makeDependencies();
    standard.setUserAbstraction(UserAbstractionResp.disabled);
    const command = buildPerpsSpotToPerpsTransferCommand({
      account: ACCOUNT,
      accountRuntimeGeneration: 1,
      amount: '1',
      available: '10',
    });

    await expect(
      executePerpsSpotToPerpsTransfer(command, standard.dependencies),
    ).resolves.toMatchObject({ kind: 'success' });

    const dex = makeDependencies();
    dex.setUserAbstraction(UserAbstractionResp.dexAbstraction);
    await expect(
      executePerpsSpotToPerpsTransfer(command, dex.dependencies),
    ).resolves.toEqual({ kind: 'staleContext' });
    expect(dex.dependencies.sign).not.toHaveBeenCalled();
  });

  it('rechecks the account and Spot balance after signing before broadcast', async () => {
    const context = makeDependencies();
    const command = buildPerpsSpotToPerpsTransferCommand({
      account: ACCOUNT,
      accountRuntimeGeneration: 1,
      amount: '2.5',
      available: '10',
    });
    (context.dependencies.sign as jest.Mock).mockImplementation(async () => {
      context.setUserAbstractionReady(false);
      return VALID_SIGNATURE;
    });

    await expect(
      executePerpsSpotToPerpsTransfer(command, context.dependencies),
    ).resolves.toEqual({ kind: 'staleContext' });
    expect(context.dependencies.sendSendAsset).not.toHaveBeenCalled();
  });

  it('uses the remote abstraction as the authority before signing and before broadcast', async () => {
    const beforeSigning = makeDependencies();
    beforeSigning.setRemoteUserAbstraction(UserAbstractionResp.unifiedAccount);
    const command = buildPerpsSpotToPerpsTransferCommand({
      account: ACCOUNT,
      accountRuntimeGeneration: 1,
      amount: '1',
      available: '10',
    });

    await expect(
      executePerpsSpotToPerpsTransfer(command, beforeSigning.dependencies),
    ).resolves.toEqual({ kind: 'staleContext' });
    expect(beforeSigning.dependencies.sign).not.toHaveBeenCalled();
    expect(beforeSigning.dependencies.sendSendAsset).not.toHaveBeenCalled();
    expect(
      beforeSigning.dependencies.reconcileRemoteUserAbstraction,
    ).toHaveBeenCalledWith({
      account: command.account,
      generation: 1,
      userAbstraction: UserAbstractionResp.unifiedAccount,
    });

    const beforeBroadcast = makeDependencies();
    (beforeBroadcast.dependencies.getRemoteUserAbstraction as jest.Mock)
      .mockResolvedValueOnce(UserAbstractionResp.default)
      .mockResolvedValueOnce(UserAbstractionResp.unifiedAccount);
    await expect(
      executePerpsSpotToPerpsTransfer(command, beforeBroadcast.dependencies),
    ).resolves.toEqual({ kind: 'staleContext' });
    expect(beforeBroadcast.dependencies.sign).toHaveBeenCalledTimes(1);
    expect(beforeBroadcast.dependencies.sendSendAsset).not.toHaveBeenCalled();
  });

  it('does not broadcast when either authoritative abstraction query fails', async () => {
    const beforeSigning = makeDependencies();
    (
      beforeSigning.dependencies.getRemoteUserAbstraction as jest.Mock
    ).mockRejectedValueOnce(new Error('abstraction unavailable'));
    const command = buildPerpsSpotToPerpsTransferCommand({
      account: ACCOUNT,
      accountRuntimeGeneration: 1,
      amount: '1',
      available: '10',
    });

    await expect(
      executePerpsSpotToPerpsTransfer(command, beforeSigning.dependencies),
    ).resolves.toMatchObject({
      error: 'abstraction unavailable',
      failureReason: 'requestFailed',
      kind: 'failed',
    });
    expect(beforeSigning.dependencies.sign).not.toHaveBeenCalled();
    expect(beforeSigning.dependencies.sendSendAsset).not.toHaveBeenCalled();

    const beforeBroadcast = makeDependencies();
    (beforeBroadcast.dependencies.getRemoteUserAbstraction as jest.Mock)
      .mockResolvedValueOnce(UserAbstractionResp.default)
      .mockRejectedValueOnce(new Error('abstraction unavailable'));
    await expect(
      executePerpsSpotToPerpsTransfer(command, beforeBroadcast.dependencies),
    ).resolves.toMatchObject({
      failureReason: 'requestFailed',
      kind: 'failed',
    });
    expect(beforeBroadcast.dependencies.sign).toHaveBeenCalledTimes(1);
    expect(beforeBroadcast.dependencies.sendSendAsset).not.toHaveBeenCalled();
  });

  it('rejects an A to B to A runtime generation change during signing', async () => {
    const context = makeDependencies();
    const command = buildPerpsSpotToPerpsTransferCommand({
      account: ACCOUNT,
      accountRuntimeGeneration: 1,
      amount: '1',
      available: '10',
    });
    (context.dependencies.sign as jest.Mock).mockImplementation(async () => {
      context.setAccountRuntimeGeneration(3);
      return VALID_SIGNATURE;
    });

    await expect(
      executePerpsSpotToPerpsTransfer(command, context.dependencies),
    ).resolves.toEqual({ kind: 'staleContext' });
    expect(context.dependencies.sendSendAsset).not.toHaveBeenCalled();
  });

  it('rejects malformed prepared actions and signatures before broadcast', async () => {
    const malformedAction = makeDependencies();
    (
      malformedAction.dependencies.prepareSendAsset as jest.Mock
    ).mockReturnValue({ message: null, nonce: 0 });
    const command = buildPerpsSpotToPerpsTransferCommand({
      account: ACCOUNT,
      accountRuntimeGeneration: 1,
      amount: '1',
      available: '10',
    });

    await expect(
      executePerpsSpotToPerpsTransfer(command, malformedAction.dependencies),
    ).resolves.toMatchObject({
      failureReason: 'requestFailed',
      kind: 'failed',
    });
    expect(malformedAction.dependencies.sign).not.toHaveBeenCalled();
    expect(malformedAction.dependencies.sendSendAsset).not.toHaveBeenCalled();

    const malformedSignature = makeDependencies();
    (malformedSignature.dependencies.sign as jest.Mock).mockResolvedValue('');
    await expect(
      executePerpsSpotToPerpsTransfer(command, malformedSignature.dependencies),
    ).resolves.toMatchObject({
      failureReason: 'requestFailed',
      kind: 'failed',
    });
    expect(
      malformedSignature.dependencies.sendSendAsset,
    ).not.toHaveBeenCalled();
  });

  it('classifies cancellation separately and rejects non-ok exchange responses', async () => {
    const cancelled = makeDependencies();
    (cancelled.dependencies.sign as jest.Mock).mockRejectedValue(
      new PerpsActionUserCancelledError(),
    );
    const command = buildPerpsSpotToPerpsTransferCommand({
      account: ACCOUNT,
      accountRuntimeGeneration: 1,
      amount: '1',
      available: '10',
    });
    await expect(
      executePerpsSpotToPerpsTransfer(command, cancelled.dependencies),
    ).resolves.toMatchObject({
      failureReason: 'userCancelled',
      kind: 'failed',
    });

    const providerCancelled = makeDependencies();
    (providerCancelled.dependencies.sign as jest.Mock).mockRejectedValue({
      code: 4001,
      message: 'User rejected the request.',
    });
    await expect(
      executePerpsSpotToPerpsTransfer(command, providerCancelled.dependencies),
    ).resolves.toMatchObject({
      failureReason: 'userCancelled',
      kind: 'failed',
    });

    const rejected = makeDependencies();
    (rejected.dependencies.sendSendAsset as jest.Mock).mockResolvedValue({
      status: 'err',
    });
    await expect(
      executePerpsSpotToPerpsTransfer(command, rejected.dependencies),
    ).resolves.toMatchObject({
      failureReason: 'requestFailed',
      kind: 'failed',
    });
  });

  it('keeps a confirmed transfer successful when one refresh fails', async () => {
    const context = makeDependencies();
    (context.dependencies.refreshSpot as jest.Mock).mockRejectedValue(
      new Error('refresh failed'),
    );
    const command = buildPerpsSpotToPerpsTransferCommand({
      account: ACCOUNT,
      accountRuntimeGeneration: 1,
      amount: '1',
      available: '10',
    });

    await expect(
      executePerpsSpotToPerpsTransfer(command, context.dependencies),
    ).resolves.toEqual({
      kind: 'success',
      refreshError: 'refresh failed',
    });
  });
});

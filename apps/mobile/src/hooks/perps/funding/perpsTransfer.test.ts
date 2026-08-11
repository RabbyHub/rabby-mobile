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

const makeDependencies = () => {
  let currentAccount: Account | null = ACCOUNT;
  let available = '10';
  let userAbstraction: unknown = UserAbstractionResp.default;
  const dependencies: PerpsSpotToPerpsTransferDependencies = {
    getCurrentAccount: () => currentAccount,
    getSpotUsdcAvailable: () => available,
    getUserAbstraction: () => userAbstraction,
    prepareSendAsset: jest.fn(() => ({
      message: { type: 'sendAsset' },
      nonce: 7,
    })),
    refreshPerps: jest.fn(async () => undefined),
    refreshSpot: jest.fn(async () => undefined),
    sendSendAsset: jest.fn(async () => ({ status: 'ok' })),
    sign: jest.fn(async () => '0xsigned'),
  };
  return {
    dependencies,
    setAvailable: (next: string) => {
      available = next;
    },
    setCurrentAccount: (next: Account | null) => {
      currentAccount = next;
    },
    setUserAbstraction: (next: unknown) => {
      userAbstraction = next;
    },
  };
};

describe('Perps Spot to Perps transfer', () => {
  it('freezes a validated Spot USDC transfer command', () => {
    const command = buildPerpsSpotToPerpsTransferCommand({
      account: ACCOUNT,
      amount: '2.50',
      available: '10',
    });

    expect(command).toEqual({
      account: {
        address: ACCOUNT.address,
        brandName: ACCOUNT.brandName,
        type: ACCOUNT.type,
      },
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
        amount: '10.01',
        available: '10',
      }),
    ).toThrow('Invalid Spot USDC transfer amount');
  });

  it('prepares, signs with the frozen master account, sends, and refreshes both ledgers', async () => {
    const { dependencies } = makeDependencies();
    const command = buildPerpsSpotToPerpsTransferCommand({
      account: ACCOUNT,
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
      signature: '0xsigned',
    });
    expect(dependencies.refreshSpot).toHaveBeenCalledWith(ACCOUNT.address);
    expect(dependencies.refreshPerps).toHaveBeenCalledWith(ACCOUNT.address);
  });

  it('fails closed before signing when account, mode, or balance is stale', async () => {
    const context = makeDependencies();
    const command = buildPerpsSpotToPerpsTransferCommand({
      account: ACCOUNT,
      amount: '2.5',
      available: '10',
    });

    context.setCurrentAccount(OTHER_ACCOUNT);
    await expect(
      executePerpsSpotToPerpsTransfer(command, context.dependencies),
    ).resolves.toEqual({ kind: 'staleContext' });
    context.setCurrentAccount(ACCOUNT);
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

  it('rechecks the account and Spot balance after signing before broadcast', async () => {
    const context = makeDependencies();
    const command = buildPerpsSpotToPerpsTransferCommand({
      account: ACCOUNT,
      amount: '2.5',
      available: '10',
    });
    (context.dependencies.sign as jest.Mock).mockImplementation(async () => {
      context.setCurrentAccount(OTHER_ACCOUNT);
      return '0xsigned';
    });

    await expect(
      executePerpsSpotToPerpsTransfer(command, context.dependencies),
    ).resolves.toEqual({ kind: 'staleContext' });
    expect(context.dependencies.sendSendAsset).not.toHaveBeenCalled();
  });

  it('classifies cancellation separately and rejects non-ok exchange responses', async () => {
    const cancelled = makeDependencies();
    (cancelled.dependencies.sign as jest.Mock).mockRejectedValue(
      new PerpsActionUserCancelledError(),
    );
    const command = buildPerpsSpotToPerpsTransferCommand({
      account: ACCOUNT,
      amount: '1',
      available: '10',
    });
    await expect(
      executePerpsSpotToPerpsTransfer(command, cancelled.dependencies),
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
});

import type { Account } from '@/core/startupServices/preference';
import {
  buildPerpsSpotToPerpsTransferCommand,
  executePerpsSpotToPerpsTransferCore,
  type PerpsSpotToPerpsTransferDependencies,
} from '@/hooks/perps/funding/perpsTransferCore';
import { UserAbstractionResp } from '@rabby-wallet/hyperliquid-sdk';

import { buildPerpsAccountViewModel } from '../model/account';

const ACCOUNT = {
  address: '0x1111111111111111111111111111111111111111',
  brandName: 'Rabby',
  type: 'SimpleKeyring',
} as Account;
const VALID_SIGNATURE = `0x${'11'.repeat(65)}`;
const SPOT_USDC = {
  available: '10',
  coin: 'USDC',
  entryNtl: '0',
  hold: '0',
  token: 0,
  total: '10',
};

const buildAccount = (userAbstraction: UserAbstractionResp) =>
  buildPerpsAccountViewModel({
    clearinghouseState: null,
    marketDataMap: {},
    spotAssetCtxs: {},
    spotMeta: null,
    spotState: {
      rawBalances: [SPOT_USDC],
      rawBalancesByToken: { 0: SPOT_USDC },
    },
    userAbstraction,
  });

const makeDependencies = (userAbstraction: UserAbstractionResp) => {
  let currentUserAbstraction = userAbstraction;
  const sent: Array<{ action: unknown; nonce: number; signature: string }> = [];
  const refreshed: string[] = [];
  const dependencies: PerpsSpotToPerpsTransferDependencies = {
    getAccountRuntimeGeneration: () => 1,
    getCurrentAccount: () => ACCOUNT,
    getRemoteUserAbstraction: async () => currentUserAbstraction,
    getSpotUsdcAvailable: () => SPOT_USDC.available,
    getUserAbstraction: () => currentUserAbstraction,
    getUserAbstractionReady: () => true,
    prepareSendAsset: params => ({
      message: { ...params, type: 'sendAsset' },
      nonce: 7,
    }),
    refreshPerps: address => {
      refreshed.push(`perps:${address}`);
    },
    refreshSpot: address => {
      refreshed.push(`spot:${address}`);
    },
    reconcileRemoteUserAbstraction: ({ userAbstraction: next }) => {
      currentUserAbstraction = next as UserAbstractionResp;
    },
    sendSendAsset: params => {
      sent.push(params);
      return Promise.resolve({ status: 'ok' });
    },
    sign: async () => VALID_SIGNATURE,
  };
  return { dependencies, refreshed, sent };
};

describe('Perps Pro Standard Spot USDC Transfer integration', () => {
  it.each([UserAbstractionResp.default, UserAbstractionResp.disabled])(
    'connects the real account model, command, and executor for %s',
    async userAbstraction => {
      const asset = buildAccount(userAbstraction).assets[0];
      expect(asset).toMatchObject({
        action: 'transfer',
        coin: 'USDC',
        key: 'spot:USDC',
        ledger: 'spot',
      });
      const command = buildPerpsSpotToPerpsTransferCommand({
        account: ACCOUNT,
        accountRuntimeGeneration: 1,
        amount: '2.5',
        available: asset.available,
      });
      const context = makeDependencies(userAbstraction);

      await expect(
        executePerpsSpotToPerpsTransferCore(command, context.dependencies),
      ).resolves.toEqual({ kind: 'success', refreshError: undefined });
      expect(context.sent).toEqual([
        {
          action: {
            amount: '2.5',
            destination: ACCOUNT.address,
            destinationDex: '',
            sourceDex: 'spot',
            token: 'USDC',
            type: 'sendAsset',
          },
          nonce: 7,
          signature: VALID_SIGNATURE,
        },
      ]);
      expect(context.refreshed).toEqual([
        `spot:${ACCOUNT.address}`,
        `perps:${ACCOUNT.address}`,
      ]);
    },
  );

  it.each([
    UserAbstractionResp.unifiedAccount,
    UserAbstractionResp.dexAbstraction,
  ])(
    'keeps %s out of both the visible action and executor',
    async userAbstraction => {
      const asset = buildAccount(userAbstraction).assets[0];
      expect(asset).toMatchObject({
        action: 'none',
        key:
          userAbstraction === UserAbstractionResp.unifiedAccount
            ? 'unified:0'
            : 'spot:USDC',
      });

      const command = buildPerpsSpotToPerpsTransferCommand({
        account: ACCOUNT,
        accountRuntimeGeneration: 1,
        amount: '1',
        available: asset.available,
      });
      const context = makeDependencies(userAbstraction);
      await expect(
        executePerpsSpotToPerpsTransferCore(command, context.dependencies),
      ).resolves.toEqual({ kind: 'staleContext' });
      expect(context.sent).toEqual([]);
    },
  );
});

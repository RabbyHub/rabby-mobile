import {
  HYPE_EVM_BRIDGE_ADDRESS_MAP,
  HYPE_SEND_ASSET_TOKEN_MAP,
} from '@/constant/perps';
import { apisPerps } from '@/core/apis/perps';
import type { Account } from '@/core/startupServices/preference';

import { showToast } from '../showToast';
import {
  createPerpsFundingOperation,
  persistPerpsFundingJournalEntry,
} from './fundingHistory';
import { signPerpsMasterTypedData } from './signPerpsMasterTypedData';
import type { AccountHistoryItem, PerpsWithdrawTarget } from './types';

type SetLocalLoadingHistory = (
  payload: AccountHistoryItem[],
  isReset?: boolean,
) => void;

interface ExecutePerpsWithdrawParams {
  account: Account | null;
  amount: number | string;
  isAccountCurrent?: (account: Account) => boolean;
  isHypeWithdraw?: boolean;
  isSpotCollateralMode?: boolean;
  targetAsset?: PerpsWithdrawTarget;
  setLocalLoadingHistory: SetLocalLoadingHistory;
}

export const executePerpsWithdraw = async ({
  account,
  amount,
  isAccountCurrent,
  isHypeWithdraw = false,
  isSpotCollateralMode = false,
  targetAsset = 'USDC',
  setLocalLoadingHistory,
}: ExecutePerpsWithdrawParams): Promise<boolean> => {
  try {
    const sdk = apisPerps.getPerpsSDK();

    if (!account) {
      throw new Error('No currentPerpsAccount address');
    }

    if (!sdk.exchange) {
      throw new Error('Hyperliquid no exchange client');
    }

    if (
      targetAsset !== 'USDC' &&
      targetAsset !== 'USDT' &&
      targetAsset !== 'USDH' &&
      targetAsset !== 'USDE'
    ) {
      throw new Error(`Invalid target asset, targetAsset: ${targetAsset}`);
    }

    const tokenId = HYPE_SEND_ASSET_TOKEN_MAP[targetAsset];
    const hyperDestination = HYPE_EVM_BRIDGE_ADDRESS_MAP[targetAsset];

    const action = isHypeWithdraw
      ? sdk.exchange.prepareSendAsset({
          destination: hyperDestination,
          amount: amount.toString(),
          token: tokenId,
          sourceDex: isSpotCollateralMode ? 'spot' : '',
          destinationDex: 'spot',
        })
      : sdk.exchange.prepareWithdraw({
          amount: amount.toString(),
          destination: account.address,
        });
    const time =
      typeof action.nonce === 'number' &&
      Number.isSafeInteger(action.nonce) &&
      action.nonce > 0
        ? action.nonce
        : Date.now();

    const signature = await signPerpsMasterTypedData({
      account,
      action,
      miniSignError: new Error('Withdraw failed'),
    });

    const res = isHypeWithdraw
      ? await sdk.exchange.sendSendAsset({
          action: action.message as any,
          nonce: action.nonce || 0,
          signature,
        })
      : await sdk.exchange.sendWithdraw({
          action: action.message as any,
          nonce: action.nonce || 0,
          signature,
        });

    const displayAmount = isHypeWithdraw
      ? amount.toString()
      : (+amount - 1).toString();
    const operation = createPerpsFundingOperation({
      account,
      history: {
        amount: displayAmount,
        asset: targetAsset,
        settlementAmount: displayAmount,
      },
      identity: {
        settlementNonce: action.nonce,
        sourceHash: res.hash || undefined,
      },
      localType: 'withdraw',
      time,
    });
    if (operation) {
      await persistPerpsFundingJournalEntry(operation.journalEntry);
    }
    if (operation && (!isAccountCurrent || isAccountCurrent(account))) {
      setLocalLoadingHistory([operation.historyItem], false);
    }
    return true;
  } catch (error: any) {
    console.error('Failed to withdraw:', error);
    showToast(error.message || 'Withdraw failed', 'error');
    return false;
  }
};

import {
  HYPE_EVM_BRIDGE_ADDRESS_MAP,
  HYPE_SEND_ASSET_TOKEN_MAP,
} from '@/constant/perps';
import { apisPerps } from '@/core/apis/perps';
import type { Account } from '@/core/startupServices/preference';

import { showToast } from '../showToast';
import type { AccountHistoryItem } from '../usePerpsStore';
import { signPerpsMasterTypedData } from './signPerpsMasterTypedData';
import type { PerpsWithdrawTarget } from './types';

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

    // The server-side HYPE send timestamp can be slightly earlier than the
    // client clock. Backdating keeps the pending entry removable by the next
    // confirmed history event, matching the existing deposit path.
    const time = Date.now() - 1000;
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

    if (!isAccountCurrent || isAccountCurrent(account)) {
      setLocalLoadingHistory(
        [
          {
            time,
            hash: res.hash || '',
            type: 'withdraw',
            status: 'pending',
            usdValue: isHypeWithdraw
              ? amount.toString()
              : (+amount - 1).toString(),
          },
        ],
        false,
      );
    }
    return true;
  } catch (error: any) {
    console.error('Failed to withdraw:', error);
    showToast(error.message || 'Withdraw failed', 'error');
    return false;
  }
};

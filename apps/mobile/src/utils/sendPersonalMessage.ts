import * as apiProvider from '@/core/apis/provider';
import type { Account } from '@/types/account';
import { eventBus, EVENTS } from './events';
import { INTERNAL_REQUEST_SESSION } from '@/constant';

// fail code
export enum FailedCode {
  SubmitTxFailed = 'SubmitTxFailed',
  DefaultFailed = 'DefaultFailed',
}

type ProgressStatus = 'building' | 'builded' | 'signed' | 'submitted';

/**
 * send personal message without rpcFlow
 * @param data
 * @param onProgress callback
 */
export const sendPersonalMessage = async ({
  data,
  onProgress,
  account: currentAccount,
}: {
  data: string[];
  onProgress?: (status: ProgressStatus) => void;
  ga?: Record<string, any>;
  account: Account;
}) => {
  onProgress?.('building');

  onProgress?.('builded');

  // submit tx
  let hash = '';
  try {
    hash = await apiProvider.ethPersonalSign({
      data: {
        params: data,
      },
      approvalRes: {
        extra: {
          brandName: currentAccount.brandName,
          signTextMethod: 'personalSign',
        },
      },
      session: INTERNAL_REQUEST_SESSION,
      account: currentAccount,
    });
  } catch (e) {
    const err = new Error((e as any).message);
    err.name = FailedCode.SubmitTxFailed;
    eventBus.emit(EVENTS.COMMON_HARDWARE.REJECTED, err.message);
    throw err;
  }

  onProgress?.('signed');

  return {
    txHash: hash,
  };
};

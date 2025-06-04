import { apiProvider } from '@/core/apis';
import { Account } from '@/core/services/preference';
import { matomoRequestEvent } from './analytics';
import { eventBus, EVENTS } from './events';
import { stats } from './stats';
import { getKRCategoryByType } from './transaction';
import { INTERNAL_REQUEST_SESSION } from '@/constant';

// fail code
export enum FailedCode {
  SubmitTxFailed = 'SubmitTxFailed',
  DefaultFailed = 'DefaultFailed',
}

const report = async ({
  action,
  currentAccount,
  extra,
}: {
  action:
    | 'createSignText'
    | 'startSignText'
    | 'cancelSignText'
    | 'completeSignText';
  currentAccount;
  extra?: Record<string, any>;
}) => {
  if (!currentAccount) {
    return;
  }
  matomoRequestEvent({
    category: 'SignText',
    action: action,
    label: [
      getKRCategoryByType(currentAccount.type),
      currentAccount.brandName,
    ].join('|'),
    transport: 'beacon',
  });
  await stats.report(action, {
    type: currentAccount.brandName,
    category: getKRCategoryByType(currentAccount.type),
    method: 'personalSign',
    ...extra,
  });
};

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

  report({
    action: 'createSignText',
    currentAccount,
  });

  onProgress?.('builded');

  const handleSendAfter = async () => {
    report({
      action: 'completeSignText',
      currentAccount,
    });
  };

  report({ action: 'startSignText', currentAccount });

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
    await handleSendAfter();
  } catch (e) {
    await handleSendAfter();
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

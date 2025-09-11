import { Account } from '@/core/services/preference';
import { matomoRequestEvent } from './analytics';
import { stats } from './stats';
import { getKRCategoryByType } from './transaction';
import { apisKeyring } from '@/core/apis/keyring';
import { eventBus } from '@rabby-wallet/keyring-utils';
import { EVENTS } from './events';

// fail code
export enum FailedCode {
  SubmitTxFailed = 'SubmitTxFailed',
  DefaultFailed = 'DefaultFailed',
}

const report = async ({
  action,
  currentAccount,
  method,
  extra,
}: {
  action:
    | 'createSignText'
    | 'startSignText'
    | 'cancelSignText'
    | 'completeSignText';
  currentAccount;
  method: string;
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
    method,
    ...extra,
  });
};

type ProgressStatus = 'building' | 'builded' | 'signed' | 'submitted';

export const sendSignTypedData = async ({
  data,
  from,
  version,
  onProgress,
  // ga,
  account: currentAccount,
}: {
  from: string;
  data: Record<string, any>;
  version: 'V1' | 'V3' | 'V4';
  onProgress?: (status: ProgressStatus, hash?: string) => void;
  ga?: Record<string, any>;
  account?: Account;
}) => {
  if (!currentAccount) {
    throw new Error('Account is required for signing typed data');
  }
  onProgress?.('building');
  // const { address, ...currentAccount } = account;

  const method = `ethSignTypedData${version === 'V1' ? '' : version}`;
  report({
    action: 'createSignText',
    currentAccount,
    method,
  });

  onProgress?.('builded');

  const handleSendAfter = async () => {
    report({
      action: 'completeSignText',
      currentAccount,
      method,
    });
  };

  report({ action: 'startSignText', currentAccount, method });

  let hash = '';
  try {
    const data1 = data as any;

    hash = await apisKeyring.signTypedData(currentAccount?.type, from, data1, {
      brandName: currentAccount.brandName,
      signTextMethod: method,
      version: version,
    });

    await handleSendAfter();
  } catch (e) {
    console.error(e);
    await handleSendAfter();
    const err = new Error((e as any).message);
    err.name = FailedCode.SubmitTxFailed;
    eventBus.emit(EVENTS.COMMON_HARDWARE.REJECTED, err.message);
    throw err;
  }

  onProgress?.('signed', hash);

  return {
    txHash: hash,
  };
};

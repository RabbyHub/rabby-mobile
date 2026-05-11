import { openapi } from '@/core/request';
import type { Account } from '@/types/account';
import { gasAccountService } from '@/core/services/shared';
import { matomoRequestEvent } from '@/utils/analytics';

const fireGasAccountStatusEvent = (hasBalance: boolean) => {
  matomoRequestEvent({
    category: 'Gas Account',
    action: `GasAccount_On_${hasBalance ? 'True' : 'False'}`,
  });
  gasAccountService.markGa4ActiveTracked();
};

const getGasAccountHasBalance = async (sig: string, accountId: string) => {
  try {
    const info = await openapi.getGasAccountInfo({
      sig,
      id: accountId,
    });

    return Number(info?.account?.balance || 0) > 0;
  } catch (error) {
    console.error('[getGasAccountHasBalance] failed', error);
    return undefined;
  }
};

const syncGasAccountBalanceState = async (sig: string, accountId: string) => {
  const hasBalance = await getGasAccountHasBalance(sig, accountId);
  if (typeof hasBalance !== 'boolean') {
    return undefined;
  }

  gasAccountService.setCurrentBalanceState(accountId, hasBalance);
  return hasBalance;
};

export const handleGasAccountLoginSuccess = async (
  signature: string,
  account: Account,
) => {
  const previousSig = gasAccountService.getGasAccountSig();
  const previousBalanceState = gasAccountService.getCurrentBalanceState();
  const wasLoggedIn = !!previousSig.sig && !!previousSig.accountId;
  const hadBalance =
    previousBalanceState.accountId === previousSig.accountId
      ? previousBalanceState.hasBalance
      : undefined;
  const isFirstLogin = gasAccountService.markLoggedIn();

  gasAccountService.setGasAccountSig(signature, account);

  if (isFirstLogin) {
    matomoRequestEvent({
      category: 'Gas Account',
      action: 'GasAccount_FirstLogin',
    });
  }

  const hasBalance = await syncGasAccountBalanceState(
    signature,
    account.address,
  );
  if (hasBalance === undefined) {
    return;
  }

  if (!wasLoggedIn || (hadBalance === false && hasBalance)) {
    fireGasAccountStatusEvent(hasBalance);
  }
};

const trackGasAccountActiveStatus = async () => {
  const { sig, accountId } = gasAccountService.getGasAccountSig();

  if (!sig || !accountId) {
    return false;
  }

  const hasBalance = await syncGasAccountBalanceState(sig, accountId);
  if (hasBalance === undefined) {
    return false;
  }

  fireGasAccountStatusEvent(hasBalance);
  return true;
};

export const trackGasAccountActiveStatusOncePerDay = async () => {
  if (gasAccountService.hasTrackedGa4ActiveToday()) {
    return false;
  }

  return trackGasAccountActiveStatus();
};

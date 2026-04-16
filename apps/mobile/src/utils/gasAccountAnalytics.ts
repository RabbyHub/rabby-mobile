import { openapi } from '@/core/request';
import { Account } from '@/core/services/preference';
import type { GasAccountService } from '@/core/services/gasAccount';
import {
  getServiceReady,
  SERVICE_READY_KEYS,
} from '@/core/services/serviceReady';
import { matomoRequestEvent } from '@/utils/analytics';

const getGasAccountService = () =>
  getServiceReady<GasAccountService>(SERVICE_READY_KEYS.gasAccountService);

const fireGasAccountStatusEvent = async (hasBalance: boolean) => {
  const gasAccountService = await getGasAccountService();
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
  const gasAccountService = await getGasAccountService();
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
  const gasAccountService = await getGasAccountService();
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
    await fireGasAccountStatusEvent(hasBalance);
  }
};

const trackGasAccountActiveStatus = async () => {
  const gasAccountService = await getGasAccountService();
  const { sig, accountId } = gasAccountService.getGasAccountSig();

  if (!sig || !accountId) {
    return false;
  }

  const hasBalance = await syncGasAccountBalanceState(sig, accountId);
  if (hasBalance === undefined) {
    return false;
  }

  await fireGasAccountStatusEvent(hasBalance);
  return true;
};

export const trackGasAccountActiveStatusOncePerDay = async () => {
  const gasAccountService = await getGasAccountService();
  if (gasAccountService.hasTrackedGa4ActiveToday()) {
    return false;
  }

  return trackGasAccountActiveStatus();
};

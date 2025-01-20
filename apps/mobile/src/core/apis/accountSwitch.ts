import { preferenceService } from '../services';
import { Account } from '../services/preference';

export async function getLastUsedAccount() {
  return preferenceService.getLastUsedAccount();
}

export async function enableSceneAccount(
  account?: Account,
  options?: {
    activeLastUsedAccountOptions?: Parameters<
      typeof preferenceService.activateLastUsedAccount
    >[0];
  },
) {
  if (account) {
    preferenceService.setLastUsedAccount(account);
  }

  await preferenceService.activateLastUsedAccount(
    options?.activeLastUsedAccountOptions,
  );

  return {
    currentAccount: preferenceService.getCurrentAccount(),
  };
}

export async function inactivateSceneAccount() {
  return preferenceService.inactivateLastUsedAccount();
}

import { preferenceService } from '../services';
import { Account } from '../services/preference';

export async function getLastUsedAccount() {
  return preferenceService.getLastUsedAccount();
}

export async function enableSceneAccount(account?: Account) {
  if (account) {
    preferenceService.setLastUsedAccount(account);
  }

  await preferenceService.activateLastUsedAccount();

  return {
    currentAccount: preferenceService.getCurrentAccount(),
  };
}

export async function inactivateSceneAccount() {
  return preferenceService.inactivateLastUsedAccount();
}

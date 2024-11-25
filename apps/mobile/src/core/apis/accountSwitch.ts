import { preferenceService } from '../services';
import { Account } from '../services/preference';

export function setLastUsedAccount(account: Account) {
  preferenceService.setLastUsedAccount(account);
}

export async function getLastUsedAccount() {
  return preferenceService.getLastUsedAccount();
}

export async function enableSceneAccount(account?: Account) {
  if (account) {
    preferenceService.setLastUsedAccount(account);
  }

  await preferenceService.activateLastUsedAccount();

  const dispose = () => {
    return preferenceService.inactivateLastUsedAccount();
  };

  return {
    dispose,
  };
}

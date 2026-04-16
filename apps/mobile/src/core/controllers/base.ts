import cloneDeep from 'lodash/cloneDeep';
import type { Account } from '../services/preference';
import { addressUtils } from '@rabby-wallet/base-utils';
import {
  getServiceReady,
  SERVICE_READY_KEYS,
} from '@/core/services/serviceReady';
import type KeyringService from '@rabby-wallet/service-keyring';
import type { PreferenceService } from '@/core/services/preference';

const { isSameAddress } = addressUtils;

class BaseController {
  @Reflect.metadata('PRIVATE', true)
  getCurrentAccount = async () => {
    const [keyringService, preferenceService] = await Promise.all([
      getServiceReady<KeyringService>(SERVICE_READY_KEYS.keyringService),
      getServiceReady<PreferenceService>(SERVICE_READY_KEYS.preferenceService),
    ]);
    let account: Account | null | undefined =
      preferenceService.getFallbackAccount();
    if (account) {
      const accounts = await this.getAccounts();
      const matchAcct = accounts.find(acct =>
        isSameAddress(account!.address, acct.address),
      );
      if (!matchAcct) {
        account = undefined;
      }
    }

    if (!account) {
      const [defaultAccount] = await this.getAccounts();
      if (!defaultAccount) {
        return null;
      }
      preferenceService.setCurrentAccount({
        type: defaultAccount.type,
        address: defaultAccount.address,
        brandName: defaultAccount.brandName,
      });
    }

    return cloneDeep(account) as Account;
  };

  @Reflect.metadata('PRIVATE', true)
  syncGetCurrentAccount = () => {
    return null;
  };

  @Reflect.metadata('PRIVATE', true)
  getAccounts = async () => {
    const keyringService = await getServiceReady<KeyringService>(
      SERVICE_READY_KEYS.keyringService,
    );
    return keyringService.getAllVisibleAccountsArray();
  };
}

export default BaseController;

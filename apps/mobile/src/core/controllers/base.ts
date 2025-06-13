import cloneDeep from 'lodash/cloneDeep';
import { keyringService } from '../services';
import { preferenceService } from '@/core/services/shared';
import { Account } from '../services/preference';
import { addressUtils } from '@rabby-wallet/base-utils';

const { isSameAddress } = addressUtils;

class BaseController {
  @Reflect.metadata('PRIVATE', true)
  getCurrentAccount = async () => {
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
    return preferenceService.getFallbackAccount() || null;
  };

  @Reflect.metadata('PRIVATE', true)
  getAccounts = () => {
    return keyringService.getAllVisibleAccountsArray();
  };
}

export default BaseController;

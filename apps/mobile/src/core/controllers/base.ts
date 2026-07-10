import cloneDeep from 'lodash/cloneDeep';
import {
  getFallbackAccountSnapshot,
  keyringServiceApi,
  preferenceServiceApi,
} from '@/core/serviceApi';
import type { Account } from '@/types/account';
import { addressUtils } from '@rabby-wallet/base-utils';

const { isSameAddress } = addressUtils;

class BaseController {
  @Reflect.metadata('PRIVATE', true)
  getCurrentAccount = async () => {
    let account: Account | null | undefined =
      getFallbackAccountSnapshot();
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
      await preferenceServiceApi.setCurrentAccount({
        type: defaultAccount.type,
        address: defaultAccount.address,
        brandName: defaultAccount.brandName,
      });
    }

    return cloneDeep(account) as Account;
  };

  @Reflect.metadata('PRIVATE', true)
  syncGetCurrentAccount = () => {
    return getFallbackAccountSnapshot() || null;
  };

  @Reflect.metadata('PRIVATE', true)
  getAccounts = () => {
    return keyringServiceApi.getAllVisibleAccountsArray();
  };
}

export default BaseController;

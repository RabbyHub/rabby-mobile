import { WalletConnectKeyring } from '@rabby-wallet/eth-walletconnect-keyring';
import { generateAliasName, KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { KeyringServiceOptions } from '@rabby-wallet/service-keyring/src/keyringService';
import { contactService } from '.';

export const onSetAddressAlias: KeyringServiceOptions['onSetAddressAlias'] =
  async (keyring, account) => {
    const { address, brandName } = account;
    const existAlias = contactService.getContactByAddress(address);
    if (!existAlias) {
      const accounts = await keyring.getAccounts();

      let addressCount = accounts.length - 1; // TODO: change 1 to real count of accounts if this function can add multiple accounts
      if (keyring.type === KEYRING_CLASS.WALLETCONNECT) {
        const accountWithBrands = await (
          keyring as unknown as WalletConnectKeyring
        ).getAccountsWithBrand();
        addressCount =
          accountWithBrands.filter(
            item =>
              item.brandName === brandName || item.realBrandName === brandName,
          ).length - 1;
      }
      const alias = generateAliasName({
        brandName,
        keyringType: keyring.type,
        addressCount,
      });
      contactService.setAlias({
        address,
        alias,
      });
    }
  };

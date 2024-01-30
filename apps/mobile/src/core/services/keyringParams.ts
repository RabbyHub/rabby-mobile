import { WalletConnectKeyring } from '@rabby-wallet/eth-walletconnect-keyring';
import { generateAliasName, KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { KeyringServiceOptions } from '@rabby-wallet/service-keyring/src/keyringService';
import { GET_WALLETCONNECT_CONFIG } from '../apis/keyring';
import { bindWalletConnectEvents } from '../apis/walletconnect';
import { contactService } from './shared';

export const onSetAddressAlias: KeyringServiceOptions['onSetAddressAlias'] =
  async (keyring, account) => {
    const { address, brandName } = account;
    const existAlias = contactService.getContactByAddress(address);

    console.log('onSetAddressAlias', address, brandName);

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
    } else {
      contactService.setAlias({
        address,
        alias: existAlias.name,
      });
    }
  };

export const onCreateKeyring: KeyringServiceOptions['onCreateKeyring'] =
  Keyring => {
    const keyring =
      Keyring?.type === KEYRING_CLASS.WALLETCONNECT
        ? new Keyring(GET_WALLETCONNECT_CONFIG())
        : new Keyring();

    if (Keyring.type === KEYRING_CLASS.WALLETCONNECT) {
      bindWalletConnectEvents(keyring);
    }

    return keyring;
  };

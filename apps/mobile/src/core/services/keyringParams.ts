import { bindLedgerEvents } from '@/utils/ledger';
import { bindOneKeyEvents } from '@/utils/onekey';
import { bindWalletConnectEvents } from '@/utils/wc';
import { WalletConnectKeyring } from '@rabby-wallet/eth-walletconnect-keyring';
import { generateAliasName, KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { KeyringServiceOptions } from '@rabby-wallet/service-keyring/src/keyringService';
import { getKeyringParams } from '../utils/getKeyringParams';

export const onSetAddressAlias: KeyringServiceOptions['onSetAddressAlias'] =
  async (keyring, account, contactService) => {
    const { address, brandName } = account;
    const existAlias = contactService.getAliasByAddress(address);

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
        alias: existAlias.alias,
      });
    }
  };

export const onCreateKeyring: KeyringServiceOptions['onCreateKeyring'] =
  Keyring => {
    const keyring = new Keyring(getKeyringParams(Keyring.type as any));

    if (Keyring.type === KEYRING_CLASS.WALLETCONNECT) {
      bindWalletConnectEvents(keyring);
    }

    if (Keyring.type === KEYRING_CLASS.HARDWARE.LEDGER) {
      bindLedgerEvents(keyring);
    }

    if (Keyring.type === KEYRING_CLASS.HARDWARE.ONEKEY) {
      bindOneKeyEvents(keyring);
    }

    return keyring;
  };

import { apiMnemonic } from '@/core/apis';
import { WALLET_INFO } from '@/utils/walletInfo';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export const KEYRING_TYPE_TEXT = {
  [KEYRING_TYPE.HdKeyring]: 'Created by Seed Phrase',
  [KEYRING_TYPE.SimpleKeyring]: 'Imported by Private Key',
  [KEYRING_TYPE.WatchAddressKeyring]: 'Contact',
  // [KEYRING_CLASS.HARDWARE.BITBOX02]: 'Imported by BitBox02',
  [KEYRING_CLASS.HARDWARE.LEDGER]: 'Imported by Ledger',
  [KEYRING_CLASS.HARDWARE.TREZOR]: 'Imported by Trezor',
  [KEYRING_CLASS.HARDWARE.ONEKEY]: 'Imported by Onekey',
  // [KEYRING_CLASS.HARDWARE.GRIDPLUS]: 'Imported by GridPlus',
  [KEYRING_CLASS.GNOSIS]: 'Imported by Safe',
  [KEYRING_CLASS.HARDWARE.KEYSTONE]: 'Imported by QRCode Base',
  // [KEYRING_CLASS.HARDWARE.IMKEY]: 'Imported by imKey',
};

export const useAddressSource = ({
  type,
  brandName,
  byImport = false,
  address,
}: {
  type: string;
  brandName: string;
  byImport?: boolean;
  address?: string;
}) => {
  const { t } = useTranslation();
  const [source, setSource] = useState<string>('');

  useEffect(() => {
    if (byImport === true && KEYRING_TYPE.HdKeyring === type) {
      if (address) {
        apiMnemonic
          .getMnemonicKeyringIfNeedPassphrase('address', address)
          .then(needPassphrase => {
            if (needPassphrase) {
              setSource(t('constant.IMPORTED_HD_KEYRING_NEED_PASSPHRASE'));
            } else {
              setSource(t('constant.IMPORTED_HD_KEYRING'));
            }
          });
      } else {
        setSource(t('constant.IMPORTED_HD_KEYRING'));
      }
      return;
    }
    const dict = {
      [KEYRING_TYPE.HdKeyring]: t('constant.KEYRING_TYPE_TEXT.HdKeyring'),
      [KEYRING_TYPE.SimpleKeyring]: t(
        'constant.KEYRING_TYPE_TEXT.SimpleKeyring',
      ),
      [KEYRING_TYPE.WatchAddressKeyring]: t(
        'constant.KEYRING_TYPE_TEXT.WatchAddressKeyring',
      ),
    };
    if (dict[type]) {
      setSource(dict[type]);
      return;
    }
    if (KEYRING_TYPE_TEXT[type]) {
      setSource(KEYRING_TYPE_TEXT[type]);
      return;
    }
    if (WALLET_INFO[brandName]) {
      setSource(WALLET_INFO[brandName].name);
      return;
    }
  }, [type, brandName, byImport, address, t]);

  return source;
};

import React, { useMemo } from 'react';
import { useTheme2024 } from '@/hooks/theme';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { splitNumberByStep } from '@/utils/number';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useTranslation } from 'react-i18next';
import { LedgerHDPathTypeLabel, useAccountsInfo } from '@/hooks/useAccountInfo';
import { useAddressSource } from '@/hooks/useAddressSource';
import { GnosisSafeInfoBar } from './GnosisSafeInfoBar';
import { SeedPhraseBar } from './SeedPhraseBar';
import { createGetStyles2024 } from '@/utils/styles';
import { Card } from '../Card';
import { Item } from './Item';

interface AddressInfoProps {
  account: KeyringAccountWithAlias;
  onCancel: () => void;
}

export const AddressAssetsItem: React.FC<AddressInfoProps> = props => {
  const { account, onCancel } = props;
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const useValue = useMemo(
    () => `$${splitNumberByStep(account.balance?.toFixed(2) || 0)}`,
    [account.balance],
  );

  const accountInfo = useAccountsInfo(
    account.type,
    account.address,
    account.brandName,
  );

  const source = useAddressSource({
    type: account.type,
    brandName: account.brandName,
    byImport: account.byImport,
    address: account.address,
    needPassphrase: account.needPassphrase,
  });

  const fallbackHdPathTypeLabel = account.hdPathType
    ? LedgerHDPathTypeLabel[
        account.hdPathType as keyof typeof LedgerHDPathTypeLabel
      ] || account.hdPathType
    : '';
  const fallbackHdPathValue =
    fallbackHdPathTypeLabel && account.hdPathIndex !== undefined
      ? `${fallbackHdPathTypeLabel} #${account.hdPathIndex + 1}`
      : '';
  const hdPathValue = accountInfo
    ? `${accountInfo.hdPathTypeLabel} #${accountInfo.index}`
    : fallbackHdPathValue;

  return (
    <Card style={styles.card}>
      <Item label={t('page.addressDetail.assets')} value={useValue} />
      <Item label={t('page.addressDetail.source')} value={source} />

      {account.type === KEYRING_TYPE.HdKeyring && (
        <Item style={styles.subItemView}>
          <SeedPhraseBar account={account} onCancel={onCancel} />
        </Item>
      )}

      {account.type === KEYRING_TYPE.GnosisKeyring ? (
        <GnosisSafeInfoBar
          address={account.address}
          type={account.type}
          brandName={account.brandName}
        />
      ) : null}

      {hdPathValue ? (
        <Item label={t('page.addressDetail.hd-path')} value={hdPathValue} />
      ) : null}
    </Card>
  );
};

const getStyle = createGetStyles2024(({}) => ({
  card: {
    gap: 24,
    marginHorizontal: 16,
    width: 'auto',
  },
  subItemView: {
    marginTop: -12,
  },
}));

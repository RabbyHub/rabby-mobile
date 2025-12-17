import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { apiContact } from '@/core/apis';
import { Account } from '@/core/services/preference';
import { ellipsisAddress } from '@/utils/address';
import { useTranslation } from 'react-i18next';
import { usePerpsPopupState } from '../hooks/usePerpsPopupState';
import { CaretArrowIconCC } from '@/components/Icons/CaretArrowIconCC';

export const PerpsHeaderTitle: React.FC<{
  account?: Account | null;
}> = ({ account }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const [popupState, setPopupState] = usePerpsPopupState();

  const alias = useMemo(() => {
    if (!account?.address) {
      return;
    }
    return apiContact.getAliasName(account?.address);
  }, [account?.address]);

  return (
    <TouchableOpacity
      onPress={() => {
        setPopupState(prev => {
          return { ...prev, isShowLoginPopup: !prev.isShowLoginPopup };
        });
      }}
      disabled={!account}>
      <View style={styles.container}>
        <Text style={styles.title}>{t('page.perps.title')}</Text>
        {account ? (
          <View style={styles.addressContainer}>
            <WalletIcon
              style={styles.walletIcon}
              width={18}
              height={18}
              type={account.brandName}
              address={account.address}
            />
            <Text style={styles.address}>
              {alias || ellipsisAddress(account?.address)}
            </Text>
            <CaretArrowIconCC
              dir="down"
              style={[popupState.isShowLoginPopup ? styles.reverseCaret : null]}
              width={18}
              height={18}
              bgColor={colors2024['neutral-bg-5']}
              lineColor={colors2024['neutral-title-1']}
            />
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
  addressContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  walletIcon: {},
  address: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    color: colors2024['neutral-foot'],
  },
  reverseCaret: {
    transform: [{ rotate: '180deg' }],
  },
}));

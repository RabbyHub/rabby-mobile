import { ArrowCircleCC } from '@/assets2024/icons/address';
import {
  AddressItem,
  WalletPin,
} from '@/components2024/AddressItem/AddressItem';
import { KeyringAccountWithAlias, usePinAddresses } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { useCurveDataByAddress } from '@/hooks/useCurve';
import { apisSingleHome } from '@/screens/Home/hooks/singleHome';
import { addressUtils } from '@rabby-wallet/base-utils';
import React, { useCallback, useMemo } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { trigger } from 'react-native-haptic-feedback';
import { Text } from '@/components/Typography';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';

interface Props {
  account: KeyringAccountWithAlias;
}

export const TokenDetailWalletCard = ({ account }: Props) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { pinAddresses } = usePinAddresses({
    disableAutoFetch: true,
  });
  const { curveState } = useCurveDataByAddress(account.address);

  const isPinned = useMemo(
    () =>
      pinAddresses.some(
        item =>
          addressUtils.isSameAddress(item.address, account.address) &&
          item.brandName === account.brandName,
      ),
    [account.address, account.brandName, pinAddresses],
  );

  const handlePress = useCallback(() => {
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    apisSingleHome.navigateToSingleHome(account);
  }, [account]);

  const changePercent = curveState?.selectData?.changePercent;
  const isZeroPercentChange = changePercent === '0%';
  const isLoss = !!curveState?.selectData?.isLoss;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('page.tokenDetail.wallet')}</Text>
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.card}
        onPress={handlePress}>
        <AddressItem account={account} fetchAccount={false}>
          {({ WalletIcon, WalletName, WalletBalance }) => (
            <View style={styles.cardContent}>
              <WalletIcon width={46} height={46} borderRadius={12} />
              <View style={styles.accountContent}>
                <WalletName style={styles.accountName} />
                <View style={styles.balanceRow}>
                  <WalletBalance style={styles.balance} />
                  {typeof changePercent === 'string' && !!changePercent ? (
                    <Text
                      style={[
                        styles.percent,
                        {
                          color: !isZeroPercentChange
                            ? isLoss
                              ? colors2024['red-default']
                              : colors2024['green-default']
                            : colors2024['neutral-secondary'],
                        },
                      ]}>
                      {isZeroPercentChange ? '' : isLoss ? '-' : '+'}
                      {changePercent}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          )}
        </AddressItem>
        <ArrowCircleCC
          style={styles.arrow}
          color={colors2024['neutral-body']}
          backgroundColor={
            isLight ? colors2024['neutral-bg-5'] : colors2024['neutral-bg-2']
          }
        />
        {isPinned ? <WalletPin style={styles.pin} /> : null}
      </TouchableOpacity>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    gap: 8,
    marginTop: 24,
    marginBottom: 18,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
  },
  card: {
    height: 70,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    padding: 12,
    paddingRight: 54,
    position: 'relative',
    justifyContent: 'center',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accountContent: {
    gap: 4,
    flexShrink: 1,
  },
  accountName: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  balance: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-body'],
  },
  percent: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  arrow: {
    position: 'absolute',
    right: 12,
    top: 22,
  },
  pin: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
}));

import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

import { useTranslation } from 'react-i18next';

import { ArrowCircleCC } from '@/assets2024/icons/address';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { RootNames } from '@/constant/layout';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { useCurrency } from '@/hooks/useCurrency';
import { AddressItemContextMenu } from '@/screens/Address/components/AddressItemContextMenu';
import { trigger } from 'react-native-haptic-feedback';
import { BALANCE_HIDE_TYPE } from '../hooks/useHideBalance';
import { BlurShadowView } from '@/components2024/BluerShadow';
import BigNumber from 'bignumber.js';
import { splitNumberByStep } from '@/utils/number';
import { matomoRequestEvent } from '@/utils/analytics';
import { apisSingleHome } from '../hooks/singleHome';

export const HomeAddressItem: React.FC<{
  account: KeyringAccountWithAlias;
  style?: StyleProp<ViewStyle>;
  changePercent?: string;
  isLoss?: boolean;
  hideType?: BALANCE_HIDE_TYPE;
}> = props => {
  const { account, changePercent, isLoss, hideType } = props;
  const { navigation } = useSafeSetNavigationOptions();
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });

  const [isPressing, setIsPressing] = React.useState(false);
  const { currency } = useCurrency();

  const isZeroPercentChange = changePercent === '0%';

  const balance = useMemo(() => {
    const b = new BigNumber(account.balance || 0).times(currency.usd_rate);
    return `${currency.symbol}${splitNumberByStep(
      b.isGreaterThan(10)
        ? b.decimalPlaces(0, BigNumber.ROUND_FLOOR).toString()
        : b.toFixed(2),
    )}`;
  }, [account.balance, currency.symbol, currency.usd_rate]);

  return (
    <AddressItemContextMenu
      account={account}
      preViewBorderRadius={16}
      key={`${account.type}-${account.address}`}
      actions={['copy', 'pin', 'edit']}>
      <TouchableOpacity
        onPressIn={() => setIsPressing(true)}
        onPressOut={() => setIsPressing(false)}
        style={StyleSheet.flatten([props.style])}
        delayLongPress={200} // long press delay
        onPress={() => {
          trigger('impactLight', {
            enableVibrateFallback: true,
            ignoreAndroidSystemSettings: false,
          });
          matomoRequestEvent({
            category: 'Pin Address',
            action: 'PinAddress_ClickView',
          });
          apisSingleHome.navigateToSingleHome(account);
        }}
        onLongPress={() => {
          setIsPressing(true);
          trigger('impactLight', {
            enableVibrateFallback: true,
            ignoreAndroidSystemSettings: false,
          });
        }}>
        <AddressItem account={account} fetchAccount={false}>
          {({
            WalletIcon,
            WalletName,
            // WalletBalance,
            WalletPin,
          }) => (
            <View style={styles.accountItem}>
              <WalletIcon width={46} height={46} borderRadius={12} />
              <View style={styles.accountContent}>
                {hideType === 'HIDE' ? (
                  <>
                    <Text style={styles.accountName}>*****</Text>
                    <Text style={styles.accountBalance}>*****</Text>
                  </>
                ) : (
                  <>
                    <WalletName style={[styles.accountName]} />
                    <View style={[styles.accountBalanceRow]}>
                      <Text style={styles.accountBalance}>{balance}</Text>
                      {typeof changePercent === 'string' ? (
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
                          ]}>{`${
                          isZeroPercentChange ? '' : isLoss ? '-' : '+'
                        }${changePercent}`}</Text>
                      ) : null}
                    </View>
                  </>
                )}
              </View>
              <View style={styles.accountItemExtra}>
                <ArrowCircleCC
                  // style={styles.arrow}
                  color={colors2024['neutral-body']}
                  backgroundColor={colors2024['neutral-bg-5']}
                />
              </View>
              <WalletPin style={styles.walletPin} />
            </View>
          )}
        </AddressItem>
      </TouchableOpacity>
    </AddressItemContextMenu>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  accountItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-3'],
    padding: 12,
    width: '100%',
    position: 'relative',
  },
  accountContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  accountName: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  accountBalanceRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  accountBalance: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-body'],
  },
  walletPin: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  accountItemExtra: {
    marginLeft: 'auto',
  },
  percent: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
  hidden: {
    display: 'none',
  },
  arrow: {
    width: 26,
    height: 26,
    borderRadius: 30,
  },
}));

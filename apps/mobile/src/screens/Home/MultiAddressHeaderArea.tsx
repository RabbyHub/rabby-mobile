import React, { useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  useWindowDimensions,
  Platform,
  TouchableOpacity,
} from 'react-native';
import {
  RcIconHeaderSettings,
  RcIconHeaderRightArrow,
} from '@/assets/icons/home';
import { Button } from '@/components2024/Button';
import { RootNames, ScreenLayouts } from '@/constant/layout';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import useCurrentBalance from '@/hooks/useCurrentBalance';
import { Skeleton } from '@rneui/themed';
import { useCurve } from '@/hooks/useCurve';
import { splitNumberByStep } from '@/utils/number';
import TouchableView from '@/components/Touchable/TouchableView';
import { useCurrentAccount } from '@/hooks/account';
import { ellipsisAddress } from '@/utils/address';
import { Text, Tip } from '@/components';
import { useTranslation } from 'react-i18next';
import RcInfoCC from '@/assets/icons/home/info-cc.svg';
import RcIconSetting from '@/assets2024/icons/common/IconSetting.svg';
import RcIconSmallArrow from '@/assets2024/icons/home/IconSmallArrow.svg';
import RcIconSmallWallet from '@/assets2024/icons/home/IconSmallWallet.svg';
import { createGetStyles2024 } from '@/utils/styles';

export default function MultiAddressHeaderArea({ accountLen }) {
  const { t } = useTranslation();

  const { styles, colors2024, colors } = useTheme2024({ getStyle });
  const navigation = useRabbyAppNavigation();
  const { currentAccount } = useCurrentAccount();

  const {
    balance,
    balanceLoading,
    balanceFromCache,
    balanceUpdating,
    missingList,
  } = useCurrentBalance(currentAccount?.address, {
    update: true,
    noNeedBalance: false,
  });

  const usd = useMemo(
    () => '$' + splitNumberByStep((balance || 0).toFixed(2)),
    [balance],
  );

  const handlePressCurrentAccount = React.useCallback(() => {
    navigation.push(RootNames.StackAddress, {
      screen: RootNames.AddressList,
      params: {},
    });
  }, [navigation]);

  return (
    <View
      style={StyleSheet.compose(styles.container, {
        // height: ScreenLayouts.headerAreaHeight + top,
      })}>
      <View style={styles.topBox}>
        <Text style={styles.balanceTextBox}>Total Balance</Text>
        <TouchableView onPress={() => console.log('go to setting')}>
          <RcIconSetting />
        </TouchableView>
      </View>

      <View style={styles.bottomBox}>
        <Text style={styles.usdText}>
          {(balanceLoading && !balanceFromCache) ||
          balance === null ||
          (balanceFromCache && balance === 0) ||
          balanceUpdating ? (
            <Skeleton width={140} height={38} />
          ) : (
            usd
          )}
        </Text>
        <TouchableView
          style={styles.accountBg}
          onPress={handlePressCurrentAccount}>
          <RcIconSmallWallet />
          <Text style={styles.accountText}>{accountLen}</Text>
          <RcIconSmallArrow />
        </TouchableView>
      </View>
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    height: '100%',
    backgroundColor: colors2024['neutral-bg-1'],
    alignContent: 'center',
    paddingHorizontal: 10,
    paddingRight: 40,
    paddingTop: 16,
    flex: 1,
  },
  topBox: {
    height: ScreenLayouts.headerAreaHeight,
    // paddingLeft: 40,
    // paddingRight: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // flexShrink: 0,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  balanceTextBox: {
    color: colors2024['neutral-title-1'],
    fontWeight: '800',
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'left',
    fontFamily: 'SF Pro Rounded',
  },
  bottomBox: {
    marginTop: 10,
    backgroundColor: colors2024['neutral-bg-1'],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  usdText: {
    fontSize: 36,
    fontWeight: '800',
    textAlign: 'left',
    color: colors2024['neutral-title-1'],
    lineHeight: 42,
    fontFamily: 'SF Pro Rounded',
  },
  accountBg: {
    padding: 8,
    paddingLeft: 14,
    borderRadius: 94,
    backgroundColor: colors2024['brand-default'],
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    // border-radius: 94.114px;
    // background: var(---brand-default, #7084FF);
    // box-shadow: 0px 9.411px 22.587px 0px rgba(112, 132, 255, 0.10);
  },
  btnContainer: {
    // height: 38,
  },
  button: {
    height: 38,
  },
  accountText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'left',
    color: colors2024['neutral-InvertHighlight'],
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },
}));

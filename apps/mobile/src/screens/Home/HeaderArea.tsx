import React, { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import {
  RcIconHeaderSettings,
  RcIconHistory,
  RcIconHeaderRightArrow,
} from '@/assets/icons/home';
import { RootNames, ScreenLayouts } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';
import { useNavigation } from '@react-navigation/native';
import useCurrentBalance from '@/hooks/useCurrentBalance';
import { Skeleton } from '@rneui/themed';
import { useCurve } from '@/hooks/useCurve';
import { splitNumberByStep } from '@/utils/number';
import TouchableView from '@/components/Touchable/TouchableView';
import { useCurrentAccount } from '@/hooks/account';
import { ellipsisAddress } from '@/utils/address';
import { Text } from '@/components';
import { getWalletIcon } from '@/utils/walletInfo';
import { AppColorsVariants } from '@/constant/theme';
import { CommonSignal } from '@/components/WalletConnect/SessionSignal';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

export default function HomeHeaderArea() {
  const { width } = useWindowDimensions();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors, width), [colors, width]);
  const navigation = useNavigation();
  const { currentAccount } = useCurrentAccount();
  const { balance, balanceLoading, balanceFromCache } = useCurrentBalance(
    currentAccount?.address,
    true,
    false,
  );
  const WalletIcon = useMemo(
    () => (currentAccount ? getWalletIcon(currentAccount) : () => null),
    [currentAccount],
  );
  const { result: curveData, isLoading } = useCurve(
    currentAccount?.address,
    0,
    balance,
  );

  const usd = useMemo(
    () => '$' + splitNumberByStep((balance || 0).toFixed(2)),
    [balance],
  );
  const percent = useMemo(
    () =>
      !curveData?.changePercent
        ? ''
        : (curveData?.isLoss ? '-' : '+') + curveData?.changePercent,
    [curveData?.changePercent, curveData?.isLoss],
  );
  const isDecrease = !!curveData?.isLoss;

  const name = useMemo(
    () => currentAccount?.aliasName || currentAccount?.brandName,
    [currentAccount],
  );

  const handlePressCurrentAccount = React.useCallback(() => {
    navigation.push(RootNames.StackAddress, {
      screen: RootNames.CurrentAddress,
      params: {},
    });
  }, [navigation]);

  const handlePressIcon = React.useCallback(
    (type: 'history' | 'settings' | 'add-account') => {
      switch (type) {
        default:
          break;
        case 'settings': {
          navigation.push(RootNames.StackSettings, {
            screen: RootNames.Settings,
            params: {},
          });
          break;
        }
        case 'add-account': {
          navigation.push(RootNames.StackAddress, {
            screen: RootNames.ImportNewAddress,
            params: {},
          });
          break;
        }
        case 'history': {
          navigation.push(RootNames.StackTransaction, {
            screen: RootNames.History,
            params: {},
          });
          break;
        }
      }
    },
    [navigation],
  );

  return (
    <View
      style={StyleSheet.compose(styles.container, {
        // height: ScreenLayouts.headerAreaHeight + top,
      })}>
      <View style={styles.innerBox}>
        <TouchableView
          style={styles.touchBox}
          onPress={handlePressCurrentAccount}>
          <View style={styles.accountBox}>
            <View className="relative">
              <WalletIcon style={styles.walletIcon} />
              {currentAccount && (
                <CommonSignal
                  address={currentAccount?.address}
                  brandName={currentAccount?.brandName}
                  type={currentAccount?.type as unknown as KEYRING_TYPE}
                />
              )}
            </View>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={styles.titleText}>
              {name}
            </Text>
            <Text
              numberOfLines={1}
              ellipsizeMode="middle"
              style={styles.addressText}>
              {ellipsisAddress(currentAccount?.address || '')}
            </Text>
          </View>
          <RcIconHeaderRightArrow style={styles.accountRightArrow} />
        </TouchableView>
        <View style={styles.rightActionsBox}>
          <TouchableView onPress={() => handlePressIcon('history')}>
            <RcIconHistory style={styles.actionIcon} />
          </TouchableView>
          <TouchableView onPress={() => handlePressIcon('settings')}>
            <RcIconHeaderSettings style={styles.actionIcon} />
          </TouchableView>
        </View>
      </View>

      <View className="" style={styles.textBox}>
        {
          <Text style={styles.usdText}>
            {(balanceLoading && !balanceFromCache) ||
            balance === null ||
            (balanceFromCache && balance === 0) ? (
              <Skeleton width={140} height={38} />
            ) : (
              usd
            )}
            {!isLoading && (
              <Text
                style={StyleSheet.compose(
                  styles.percent,
                  isDecrease && styles.decrease,
                )}>
                {' '}
                {percent}
              </Text>
            )}
          </Text>
        }
      </View>
    </View>
  );
}

const getStyles = (colors: AppColorsVariants, width: number) =>
  StyleSheet.create({
    container: {
      marginLeft: -20,
      marginRight: -20,
      height: '100%',
      backgroundColor: colors['neutral-bg-1'],
      paddingTop: 12,
      alignContent: 'center',
    },
    innerBox: {
      width: '100%',
      height: ScreenLayouts.headerAreaHeight,
      paddingLeft: 20,
      paddingRight: 20,
      flexDirection: 'row',
      justifyContent: 'space-between',
      flexShrink: 0,
      backgroundColor: colors['neutral-bg-1'],
    },
    touchBox: {
      maxWidth: width - 20 - 107,
      paddingHorizontal: 8,
      height: 48,
      paddingVertical: 10,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 6,
      backgroundColor: colors['neutral-card-2'],
    },
    accountBox: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      maxWidth: width - 20 - 107 - 8 * 2 - 16,
    },
    titleText: {
      flexShrink: 1,
      color: colors['neutral-title-1'],
      fontFamily: 'SF Pro',
      fontSize: 18,
      fontWeight: '500',
      flexWrap: 'nowrap',
    },
    addressText: {
      color: colors['neutral-foot'],
      fontFamily: 'SF Pro',
      fontSize: 12,
      fontWeight: '400',
    },
    accountRightArrow: {
      width: 16,
      height: 16,
    },
    walletIcon: {
      width: 28,
      height: 28,
    },

    rightActionsBox: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 23,
      flexShrink: 0,
      gap: 16,
    },
    actionIcon: {
      width: 24,
      height: 24,
    },
    textBox: {
      height: 80,
      flexDirection: 'row',
      paddingHorizontal: 20,
      marginTop: 0,
      paddingVertical: 18,
      backgroundColor: colors['neutral-bg-1'],
    },

    usdText: {
      color: colors['neutral-title-1'],
      fontSize: 38,
      fontWeight: '700',
    },
    percent: {
      paddingLeft: 8,
      color: colors['green-default'],
      fontSize: 16,
      fontWeight: '500',
    },
    decrease: {
      color: colors['red-default'],
    },
  });

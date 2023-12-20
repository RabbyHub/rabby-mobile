import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  RcIconHeaderSettings,
  RcIconHistory,
  RcIconHeaderRightArrow,
} from '@/assets/icons/home';
import { RootNames, ScreenLayouts } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';
import { useNavigation } from '@react-navigation/native';

import TouchableView from '@/components/Touchable/TouchableView';
import { useCurrentAccount } from '@/hooks/account';
import { ellipsisAddress } from '@/utils/address';
import { Text } from '@/components';
import { getWalletIcon } from '@/utils/walletInfo';
import { AppColorsVariants } from '@/constant/theme';

export default function HomeHeaderArea() {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const navigation = useNavigation();
  const { currentAccount } = useCurrentAccount();

  const WalletIcon = useMemo(
    () => (currentAccount ? getWalletIcon(currentAccount) : () => null),
    [currentAccount],
  );

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
            <WalletIcon style={styles.walletIcon} />
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
    </View>
  );
}

const getStyles = (colors: AppColorsVariants) =>
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
      width: '100%',
      flexShrink: 1,
      paddingHorizontal: 8,
      paddingVertical: 10,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 6,
      backgroundColor: colors['neutral-card-2'],
    },
    accountBox: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'nowrap',
    },
    titleText: {
      flex: 1,
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
  });

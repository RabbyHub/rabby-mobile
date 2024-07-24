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
import { RootNames, ScreenLayouts } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import useCurrentBalance from '@/hooks/useCurrentBalance';
import { Skeleton } from '@rneui/themed';
import { useCurve } from '@/hooks/useCurve';
import { splitNumberByStep } from '@/utils/number';
import TouchableView from '@/components/Touchable/TouchableView';
import { useCurrentAccount } from '@/hooks/account';
import { ellipsisAddress } from '@/utils/address';
import { Text, Tip } from '@/components';
import { getWalletIcon } from '@/utils/walletInfo';
import { AppColorsVariants } from '@/constant/theme';
import { CommonSignal } from '@/components/WalletConnect/SessionSignal';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { PendingTxCount } from './components/PendingTxCount';
import { useUpgradeInfo } from '@/hooks/version';
import { useTranslation } from 'react-i18next';
import RcInfoCC from '@/assets/icons/home/info-cc.svg';
import RcArrowRightCC from '@/assets/icons/home/arrow-right-cc.svg';
import { CurveBottomSheetModal } from './components/CurveBottomSheet';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import usePrevious from 'ahooks/lib/usePrevious';

export default function HomeHeaderArea() {
  const { t } = useTranslation();

  const { width } = useWindowDimensions();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors, width), [colors, width]);
  const navigation = useRabbyAppNavigation();
  const { currentAccount } = useCurrentAccount();
  const WalletIcon = useMemo(
    () =>
      currentAccount ? getWalletIcon(currentAccount.brandName) : () => null,
    [currentAccount],
  );

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

  const {
    result: curveData,
    isLoading,
    refresh: refreshCurveData,
  } = useCurve(currentAccount?.address, 0, balance);

  const usd = useMemo(
    () => '$' + splitNumberByStep((balance || 0).toFixed(2)),
    [balance],
  );
  const latestPercent = useMemo(
    () =>
      !curveData?.changePercent
        ? ''
        : (curveData?.isLoss ? '-' : '+') + curveData?.changePercent,
    [curveData?.changePercent, curveData?.isLoss],
  );
  const previousAddr = usePrevious(currentAccount?.address);
  const previousPercent = usePrevious(
    latestPercent,
    () => previousAddr !== currentAccount?.address,
  );
  const percent = useMemo(() => {
    return latestPercent || previousPercent;
  }, [latestPercent, previousPercent]);

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

  const { remoteVersion } = useUpgradeInfo();

  const curveBottomSheetModalRef = useRef<BottomSheetModal>(null);

  const handlePressBalanceSection = React.useCallback(() => {
    curveBottomSheetModalRef.current?.dismiss();
    curveBottomSheetModalRef.current?.present();

    refreshCurveData();
  }, [refreshCurveData]);

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
            <PendingTxCount />
          </TouchableView>
          <TouchableView
            style={styles.settingsWrapper}
            onPress={() => handlePressIcon('settings')}>
            <RcIconHeaderSettings style={styles.actionIcon} />
            <View
              style={[
                styles.actionIconReddot,
                !remoteVersion.couldUpgrade && styles.hideReddot,
              ]}
            />
          </TouchableView>
        </View>
      </View>

      <TouchableOpacity
        style={styles.textBox}
        onPress={handlePressBalanceSection}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
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

          {balanceLoading ? (
            <Skeleton style={{ marginLeft: 1 }} width={50} height={16} />
          ) : (
            !!percent && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                <Text
                  style={StyleSheet.compose(
                    styles.percent,
                    isDecrease && styles.decrease,
                  )}>
                  {'  '}
                  {percent}
                </Text>
                <RcArrowRightCC
                  width={16}
                  height={16}
                  color={
                    isDecrease ? colors['red-default'] : colors['green-default']
                  }
                />
                {!isLoading && missingList?.length ? (
                  <Tip
                    content={t('page.dashboard.home.missingDataTooltip', {
                      text:
                        missingList.join(t('page.dashboard.home.chain')) +
                        t('page.dashboard.home.chainEnd'),
                    })}>
                    <RcInfoCC
                      style={{ marginLeft: 4 }}
                      color={colors['neutral-foot']}
                    />
                  </Tip>
                ) : null}
              </View>
            )
          )}
        </View>
      </TouchableOpacity>
      {currentAccount?.address && (
        <CurveBottomSheetModal
          key={currentAccount?.address}
          ref={curveBottomSheetModalRef}
        />
      )}
      {/* <CurveBottomSheetModal
      // key={currentAccount?.address}
      /> */}
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
      alignItems: 'center',
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
      fontSize: 16,
      fontWeight: '500',
      flexWrap: 'nowrap',
    },
    addressText: {
      color: colors['neutral-foot'],
      fontFamily: 'SF Pro',
      fontSize: 14,
      fontWeight: '400',
      marginBottom: -2,
    },
    accountRightArrow: {
      width: 16,
      height: 16,
      marginBottom: -2,
      opacity: 0.7,
    },
    walletIcon: {
      maxWidth: 24,
      maxHeight: 24,
      width: 24,
      height: 24,
    },

    rightActionsBox: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 23,
      flexShrink: 0,
      gap: 16,
    },
    settingsWrapper: {
      position: 'relative',
    },
    actionIcon: {
      width: 24,
      height: 24,
    },
    actionIconReddot: {
      width: 8,
      height: 8,
      position: 'absolute',

      top: 0,
      right: 0,
      backgroundColor: colors['red-default'],
      borderRadius: 8,
    },
    hideReddot: {
      display: 'none',
    },
    textBox: {
      height: 90,
      paddingHorizontal: 20,
      marginTop: 0,
      paddingTop: Platform.OS === 'android' ? 20 : 28,
      backgroundColor: colors['neutral-bg-1'],
    },
    usdText: {
      color: colors['neutral-title-1'],
      fontSize: 38,
      fontWeight: '700',
      textAlign: 'left',
    },
    percent: {
      color: colors['green-default'],
      fontSize: 18,
      fontWeight: '400',
      fontStyle: 'normal',
    },
    decrease: {
      color: colors['red-default'],
    },
  });

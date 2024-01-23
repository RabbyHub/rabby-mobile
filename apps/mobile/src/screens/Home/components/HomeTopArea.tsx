import { RcIconRightCC } from '@/assets/icons/common';
import {
  RcIconSend,
  RcIconReceive,
  RcIconSwap,
  RcIconMore,
  RcIconApproval,
  RcIconGasTopUp,
} from '@/assets/icons/home';
import { BSheetModal } from '@/components';
import TouchableView from '@/components/Touchable/TouchableView';
import { useCurrentAccount } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import useCurrentBalance from '@/hooks/useCurrentBalance';
import { useCurve } from '@/hooks/useCurve';
import { splitNumberByStep } from '@/utils/number';
import { createGetStyles } from '@/utils/styles';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { Skeleton } from '@rneui/themed';
import React, { useMemo } from 'react';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';

export const HomeTopArea = () => {
  const { currentAccount } = useCurrentAccount();
  const { balance, balanceLoading, balanceFromCache } = useCurrentBalance(
    currentAccount?.address,
    true,
    false,
  );
  const { result: curveData, isLoading } = useCurve(
    currentAccount?.address,
    0,
    balance,
  );
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
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

  const bottomSheetModalRef = React.useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => [436], []);

  const actions = [
    {
      title: 'Send',
      Icon: RcIconSend,
      onPress: () => {},
    },
    {
      title: 'Receive',
      Icon: RcIconReceive,
      onPress: () => {},
    },
    {
      title: 'Swap',
      Icon: RcIconSwap,
      onPress: () => {},
    },
    {
      title: 'More',
      Icon: RcIconMore,
      onPress: () => {
        bottomSheetModalRef.current?.present();
      },
    },
  ];

  const moreItems = [
    ...actions.slice(0, -1),
    {
      title: 'Approvals',
      Icon: RcIconApproval,
      onPress: () => {},
    },
    {
      title: 'Gas Top Up',
      Icon: RcIconGasTopUp,
      onPress: () => {},
    },
  ];

  return (
    <>
      <ImageBackground
        source={require('@/assets/icons/home/bg.png')}
        resizeMode="contain"
        style={styles.image}>
        <View style={styles.container}>
          <View className="mt-2" style={styles.textBox}>
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

          <View style={styles.group}>
            {actions.map(item => (
              <TouchableView
                style={styles.action}
                onPress={item.onPress}
                key={item.title}>
                <View style={styles.actionIconWrapper}>
                  <item.Icon style={styles.actionIcon} />
                </View>
                <Text style={styles.actionText}>{item.title}</Text>
              </TouchableView>
            ))}
          </View>
        </View>
      </ImageBackground>

      <BSheetModal ref={bottomSheetModalRef} snapPoints={snapPoints}>
        <BottomSheetView style={styles.list}>
          {moreItems.map(item => (
            <TouchableView
              style={styles.item}
              onPress={item.onPress}
              key={item.title}>
              <item.Icon style={styles.actionIcon} />
              <Text style={styles.itemText}>{item.title}</Text>
              <RcIconRightCC style={styles.chevron} />
            </TouchableView>
          ))}
        </BottomSheetView>
      </BSheetModal>
    </>
  );
};
const getStyles = createGetStyles(colors => ({
  container: {
    padding: 20,
  },
  image: {
    flex: 1,
    justifyContent: 'center',
  },
  textBox: {
    flexDirection: 'row',
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

  group: {
    marginTop: 38,
    marginBottom: 20,
    justifyContent: 'space-between',
    flexDirection: 'row',
  },
  action: {
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 44,
    backgroundColor: colors['neutral-card-2'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIcon: {
    width: 24,
    height: 24,
  },
  actionText: {
    color: colors['neutral-title-1'],
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
  },

  list: {
    gap: 12,
    paddingTop: 16,
    paddingHorizontal: 20,
  },

  item: {
    height: 60,
    paddingHorizontal: 16,
    backgroundColor: colors['neutral-card-2'],
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemText: {
    marginLeft: 12,
    color: colors['neutral-title-1'],
    fontSize: 16,
    fontWeight: '500',
  },
  chevron: {
    marginLeft: 'auto',
    width: 16,
    height: 16,
    color: colors['neutral-foot'],
  },
}));

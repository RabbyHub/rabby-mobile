import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { Card } from '../Card';
import RcPending from '@/assets/icons/swap/pending.svg';
import RcIconFail from '@/assets2024/icons/history/IconFail.svg';
import { TxStatusItem } from '@/screens/Transaction/HistoryDetailScreen';

interface Props {
  icon: React.ReactNode;
  title: React.ReactNode;
  subTitle: React.ReactNode;
  isPending?: boolean;
  payTokenAmount?: React.ReactNode;
  receiveTokenAmount?: React.ReactNode;
  rightContainer?: React.ReactNode;
  isFailed?: boolean;
  showSuccess?: boolean;
}

export const CommonHistoryItem: React.FC<Props> = ({
  icon,
  title,
  subTitle,
  isPending,
  isFailed,
  payTokenAmount,
  receiveTokenAmount,
  rightContainer,
  showSuccess,
}) => {
  const { styles } = useTheme2024({ getStyle });

  const spinValue = React.useRef(new Animated.Value(0)).current;
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  React.useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card style={styles.container}>
      <View style={styles.leftContainer}>
        {icon}

        <View style={styles.mainContainer}>
          <View style={styles.titleContainer}>
            <Text style={styles.titleText}>{title}</Text>
            {/* {showSuccess && !isPending && !isFailed && (
              <TxStatusItem status={1} showSuccess={true} />
            )} */}
            {isFailed && (
              <RcIconFail style={styles.arrowIcon} width={18} height={18} />
            )}
            {!isFailed && isPending && (
              <Animated.View
                style={{
                  transform: [{ rotate: spin }],
                }}>
                <RcPending style={styles.arrowIcon} />
              </Animated.View>
            )}
          </View>
          {typeof subTitle === 'string' ? (
            <Text style={styles.subTitleText}>{subTitle}</Text>
          ) : (
            subTitle
          )}
        </View>
      </View>
      {rightContainer ? (
        rightContainer
      ) : (
        <View
          style={StyleSheet.flatten([
            styles.rightContainer,
            (isPending || isFailed) && { opacity: 0.3 },
          ])}>
          <Text numberOfLines={1} style={styles.payTokenAmountText}>
            {payTokenAmount}
          </Text>
          <Text numberOfLines={1} style={styles.receiveTokenAmountText}>
            {receiveTokenAmount}
          </Text>
        </View>
      )}
    </Card>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderRadius: 16,
    paddingVertical: 14,
    paddingStart: 12,
    paddingEnd: 16,
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0,
  },
  leftContainer: {
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainContainer: {
    gap: 2,
  },
  rightContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 2,
    flex: 1,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '500',
  },
  subTitleText: {
    color: colors2024['neutral-secondary'],
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    alignItems: 'center',
  },
  arrowIcon: {
    width: 16,
    height: 16,
  },
  payTokenAmountText: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '700',
  },
  receiveTokenAmountText: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '700',
  },
}));

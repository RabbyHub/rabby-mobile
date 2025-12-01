import React, { useEffect, useMemo, useRef } from 'react';
import { Easing, Text, TouchableOpacity } from 'react-native';
import { createGetStyles, createGetStyles2024 } from '@/utils/styles';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import RcPending from '@/assets2024/icons/home/pending.svg';
import { Spin } from '@/screens/TransactionRecord/components/Spin';
import RcIconOrangeArrow from '@/assets2024/icons/home/IconOrangeArrow.svg';
import { Animated } from 'react-native';

export const PendingTx = ({
  number,
  onClick,
}: {
  number: number | string;
  onClick?: () => void;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const spinValue = useRef(new Animated.Value(0)).current;

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [spinValue]);

  return (
    <TouchableOpacity style={styles.container} onPress={onClick}>
      <Animated.View
        style={{
          transform: [{ rotate: spin }],
        }}>
        <RcPending width={16} height={16} />
      </Animated.View>
      <Text style={styles.number}>{number}</Text>
      <RcIconOrangeArrow />
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors2024, colors }) => ({
  container: {
    flexDirection: 'row',
    borderRadius: 100,
    alignItems: 'center',
    backgroundColor: colors2024['orange-light-1'],
    borderColor: colors2024['orange-light-2'],
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 1,
    gap: 0,
  },
  icon: {
    width: 20,
    height: 20,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  number: {
    marginLeft: 2,
    color: colors2024['orange-default'],
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },
}));

export default PendingTx;

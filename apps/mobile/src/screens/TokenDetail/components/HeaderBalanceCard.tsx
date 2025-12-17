import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { StyleProp, View, ViewStyle, TouchableOpacity } from 'react-native';
import RcIconRightArrowCC from '@/assets2024/icons/copyTrading/IconRrightArrowCC.svg';

interface HeaderBalanceCardProps {
  amount: string;
  usdValue: string;
  percentChange: string;
  isLoss: boolean;
  is24hNoChange: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

const HeaderBalanceCard = ({
  amount,
  usdValue,
  percentChange,
  isLoss,
  is24hNoChange,
  onPress,
  style,
}: HeaderBalanceCardProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: isLoss
            ? colors2024['red-light-1']
            : colors2024['green-light-1'],
        },
        style,
      ]}
      onPress={onPress}>
      <View style={styles.left}>
        <Text style={styles.title}>{t('page.tokenDetail.balance')}: </Text>
        <View style={styles.textContainer}>
          <Text style={styles.amount}>{amount}</Text>
          <Text style={styles.usdValue}> ≈${usdValue}</Text>
          <Text
            style={[
              styles.percentChange,
              {
                color: is24hNoChange
                  ? colors2024['neutral-foot']
                  : isLoss
                  ? colors2024['red-default']
                  : colors2024['green-default'],
              },
            ]}>
            {`(${is24hNoChange ? '' : isLoss ? '-' : '+'}${
              percentChange ? percentChange : '0.0%'
            })`}
          </Text>
        </View>
      </View>
      <RcIconRightArrowCC
        width={16}
        height={16}
        color={colors2024['neutral-foot']}
      />
    </TouchableOpacity>
  );
};

export default HeaderBalanceCard;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    height: 42,
    borderRadius: 6,
    backgroundColor: colors2024['green-light-1'],
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 2,
  },
  percentChange: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    marginLeft: 2,
  },
  title: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
  },
  amount: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  usdValue: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
  },
}));

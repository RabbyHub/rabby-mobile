import { Text, Tip } from '@/components';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { Skeleton } from '@rneui/themed';
import BigNumber from 'bignumber.js';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import RcIconCheckedCC from '@/assets/icons/gas-top-up/checked-cc.svg';
import RcIconUnCheckedCC from '@/assets/icons/gas-top-up/unchecked-cc.svg';

interface GasBoxProps {
  gasToken?: TokenItem;
  chainUsdBalance?: number;
  chainUsdBalanceLoading: boolean;
  instantGasValue: BigNumber;
  item: [number, string];
  selectedIndex: number;
  index: number;
  onSelect: (i: number) => void;
  gasTokenLoading: boolean;
}
export const GasBox = ({
  chainUsdBalanceLoading,
  chainUsdBalance,
  instantGasValue,
  index,
  selectedIndex,
  onSelect,
  gasTokenLoading,
  gasToken,
  item,
}: GasBoxProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();
  const gasCostExceedsBudget = useMemo(
    () => instantGasValue.gt(new BigNumber(item[0]).times(0.2).times(0.1)),
    [instantGasValue, item],
  );
  const chainInsufficientBalance = useMemo(
    () =>
      !chainUsdBalanceLoading &&
      chainUsdBalance !== undefined &&
      new BigNumber(chainUsdBalance).lt(item[0]),
    [chainUsdBalanceLoading, chainUsdBalance, item],
  );
  const [showTip, setShowTip] = useState(false);

  return (
    <Tip
      isVisible={showTip}
      onClose={() => setShowTip(false)}
      content={
        chainInsufficientBalance
          ? t('page.gasTopUp.InsufficientBalance')
          : gasCostExceedsBudget
          ? t('page.gasTopUp.hightGasFees')
          : ''
      }
      placement="top">
      <TouchableOpacity
        key={item[1]}
        style={[
          styles.default,
          gasCostExceedsBudget || chainInsufficientBalance
            ? styles.insufficient
            : index === selectedIndex
            ? styles.selected
            : styles.unselected,
        ]}
        onPress={() => {
          if (!(gasCostExceedsBudget || chainInsufficientBalance)) {
            onSelect(index);
          }
          if (gasCostExceedsBudget || chainInsufficientBalance) {
            setShowTip(true);
          }
        }}>
        <Text
          style={StyleSheet.flatten([
            styles.usdPrice,
            {
              color:
                gasCostExceedsBudget || chainInsufficientBalance
                  ? colors['neutral-body']
                  : index === selectedIndex
                  ? colors['blue-default']
                  : colors['neutral-title-1'],
            },
          ])}>
          ${item[0]}
        </Text>
        {gasTokenLoading || chainUsdBalanceLoading ? (
          <Skeleton width={60} height={14} />
        ) : (
          <Text
            style={{
              fontSize: 13,
              color:
                gasCostExceedsBudget || chainInsufficientBalance
                  ? colors['neutral-body']
                  : index === selectedIndex
                  ? colors['blue-default']
                  : colors['neutral-title-1'],
            }}>
            {' '}
            ≈ {item[1]} {getTokenSymbol(gasToken)}
          </Text>
        )}
        <View style={styles.iconView}>
          {index === selectedIndex ? (
            <RcIconCheckedCC
              width={24}
              height={24}
              color={colors['blue-default']}
            />
          ) : (
            <RcIconUnCheckedCC
              width={24}
              height={24}
              color={colors['neutral-line']}
            />
          )}
        </View>
      </TouchableOpacity>
    </Tip>
  );
};

const getStyles = createGetStyles(colors => ({
  default: {
    height: 60,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors['neutral-card-2'],
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  insufficient: {
    backgroundColor: colors['neutral-card-2'],
    borderColor: colors['neutral-card-2'],
    opacity: 0.6,
    borderWidth: 1,
  },
  unselected: {
    backgroundColor: colors['neutral-card-2'],
    borderColor: colors['neutral-card-2'],
  },
  selected: {
    backgroundColor: colors['blue-light1'],
    borderColor: colors['blue-default'],
  },
  usdPrice: {
    fontSize: 18,
    fontWeight: '500',
  },
  tokenPrice: {
    fontSize: 13,
  },
  iconView: {
    marginLeft: 'auto',
  },
}));

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Typography';
import { Tip } from '@/components/Tip';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

import TokenIcon from '../TokenIcon';
import type {
  BalancePositionTokenOption,
  BasicPositionTokenOption,
} from '../../utils/positionTokenSelector';

type PositionTokenSelectorBaseProps = {
  activeUnderlyingAsset: string;
  chain?: string;
  triggerVariant?: 'text' | 'pill';
  tooltipOffsetY?: number;
  symbol: string;
  onChange: (underlyingAsset: string) => void;
};

type PositionTokenSelectorProps =
  | (PositionTokenSelectorBaseProps & {
      type?: 'default';
      options?: BasicPositionTokenOption[];
    })
  | (PositionTokenSelectorBaseProps & {
      type: 'balance';
      options?: BalancePositionTokenOption[];
    });

export const PositionTokenSelector: React.FC<PositionTokenSelectorProps> = ({
  activeUnderlyingAsset,
  chain,
  options,
  symbol,
  onChange,
  triggerVariant = 'text',
  tooltipOffsetY = 4,
  type = 'default',
}) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const activeOption = useMemo(() => {
    return options?.find(
      item => item.underlyingAsset === activeUnderlyingAsset,
    );
  }, [activeUnderlyingAsset, options]);
  const canSwitch = !!options && options.length > 1;
  const showBalance = type === 'balance';

  const handleSelect = useCallback(
    (underlyingAsset: string) => {
      onChange(underlyingAsset);
      setVisible(false);
    },
    [onChange],
  );

  const displaySymbol = activeOption?.symbol || symbol;
  const isPill = triggerVariant === 'pill';

  const trigger = (
    <View style={[styles.trigger, isPill && styles.pillTrigger]}>
      {isPill ? (
        <TokenIcon
          size={26}
          chainSize={12}
          tokenSymbol={displaySymbol}
          chain={chain}
        />
      ) : null}
      <Text style={styles.symbol} numberOfLines={1} ellipsizeMode="tail">
        {displaySymbol}
      </Text>
      {canSwitch ? (
        <View style={isPill ? styles.pillArrowBox : styles.arrowBox}>
          <View style={styles.solidArrowDown} />
        </View>
      ) : null}
    </View>
  );

  if (!canSwitch) {
    return trigger;
  }

  return (
    <Tip
      noPressable
      hideArrow
      isVisible={visible}
      placement="bottom"
      onClose={() => setVisible(false)}
      contentStyle={styles.tooltipContent}
      tooltipStyle={[styles.tooltip, { marginTop: tooltipOffsetY }]}
      content={
        <View style={[styles.menu, showBalance && styles.menuWithBalance]}>
          {options.map(item => (
            <TouchableOpacity
              key={item.underlyingAsset}
              style={[styles.menuRow, showBalance && styles.menuRowWithBalance]}
              activeOpacity={0.75}
              onPress={() => handleSelect(item.underlyingAsset)}>
              <View style={styles.menuToken}>
                <TokenIcon
                  size={16}
                  chainSize={0}
                  tokenSymbol={item.symbol}
                  chain={chain}
                />
                <Text style={styles.menuSymbol}>{item.symbol}</Text>
              </View>
              {showBalance ? (
                <View style={styles.balanceArea}>
                  <Text style={styles.balanceLabel}>{t('global.Balance')}</Text>
                  <Text
                    style={styles.balanceValue}
                    numberOfLines={1}
                    ellipsizeMode="tail">
                    {(item as BalancePositionTokenOption).balanceText}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      }>
      <Pressable
        hitSlop={10}
        style={styles.pressable}
        onPress={event => {
          event.stopPropagation();
          setVisible(true);
        }}>
        {trigger}
      </Pressable>
    </Tip>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) =>
  StyleSheet.create({
    pressable: {
      flexShrink: 1,
    },
    trigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 1,
      minHeight: 20,
    },
    pillTrigger: {
      padding: 4,
      gap: 6,
      borderRadius: 100,
      backgroundColor: colors2024['neutral-line'],
    },
    arrowBox: {
      width: 10,
      height: 5,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    pillArrowBox: {
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    solidArrowDown: {
      width: 0,
      height: 0,
      borderStyle: 'solid',
      borderLeftWidth: 5,
      borderRightWidth: 5,
      borderTopWidth: 5,
      borderBottomWidth: 0,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: colors2024['neutral-secondary'],
      borderBottomColor: 'transparent',
    },
    symbol: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
    },
    tooltip: {
      shadowColor: 'rgba(25, 35, 60, 0.2)',
      shadowOffset: {
        width: 0,
        height: 12,
      },
      shadowOpacity: 1,
      shadowRadius: 32,
    },
    tooltipContent: {
      padding: 0,
      borderRadius: 12,
      backgroundColor: colors2024['neutral-bg-1'],
      elevation: 12,
    },
    menu: {
      minWidth: 126,
      padding: 12,
      gap: 6,
      borderRadius: 12,
      backgroundColor: colors2024['neutral-bg-1'],
    },
    menuWithBalance: {
      minWidth: 188,
    },
    menuRow: {
      height: 34,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    menuRowWithBalance: {
      minWidth: 188,
      justifyContent: 'space-between',
      gap: 12,
    },
    menuToken: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexShrink: 1,
    },
    menuSymbol: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: colors2024['neutral-body'],
      fontFamily: 'SF Pro Rounded',
    },
    balanceArea: {
      width: 94,
      alignItems: 'flex-end',
      justifyContent: 'center',
      flexShrink: 0,
    },
    balanceLabel: {
      fontSize: 10,
      lineHeight: 16,
      fontWeight: '400',
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
    },
    balanceValue: {
      maxWidth: 94,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
      color: colors2024['neutral-body'],
      fontFamily: 'SF Pro Rounded',
    },
  }),
);

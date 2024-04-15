import { AssetAvatar, Text, Tip } from '@/components';
import BigNumber from 'bignumber.js';
import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import React from 'react';
import { splitNumberByStep } from '@/utils/number';
import { useThemeColors } from '@/hooks/theme';
import { getTokenSymbol } from '@/utils/token';
import { createGetStyles } from '@/utils/styles';

export const GasTokenItem = ({
  item,
  cost,
  onChange,
  setTokenModalVisible,
}: {
  item: TokenItem;
  cost: string;
  onChange: (t: TokenItem) => void;
  setTokenModalVisible: any;
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [showTips, setShowTips] = useState(false);
  const notEnough = React.useMemo(
    () =>
      new BigNumber(item.amount)
        .times(item.price)
        .lt(new BigNumber(cost).times(1.2)),
    [item, cost],
  );
  return (
    <Tip
      content={'Insufficient balance'}
      isVisible={showTips}
      onClose={() => setShowTips(false)}>
      <TouchableOpacity
        style={StyleSheet.flatten(
          notEnough ? [styles.container, styles.disabled] : [styles.container],
        )}
        onPress={() => {
          if (!notEnough) {
            onChange(item);
            setTokenModalVisible(false);
          } else {
            setShowTips(true);
          }
        }}>
        <View style={styles.box}>
          <AssetAvatar
            size={32}
            chain={item.chain}
            logo={item.logo_url}
            chainSize={16}
          />
          <Text
            style={StyleSheet.flatten([
              {
                marginLeft: 16,
              },
              styles.text,
            ])}>
            {splitNumberByStep(item.amount?.toFixed(4))} {getTokenSymbol(item)}
          </Text>
        </View>
        <Text style={styles.text}>
          ${(item.amount * item.price || 0)?.toFixed(2)}
        </Text>
      </TouchableOpacity>
    </Tip>
  );
};

const getStyles = createGetStyles(colors => ({
  container: {
    paddingHorizontal: 20,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 6,
  },
  disabled: {
    opacity: 0.5,
  },
  box: { flexDirection: 'row', alignItems: 'center' },
  text: {
    fontSize: 16,
    fontWeight: '500',
    color: colors['neutral-title-1'],
  },
}));

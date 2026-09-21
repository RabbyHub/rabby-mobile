import BigNumber from 'bignumber.js';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { AssetAvatar } from '@/components';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { CustomSkeleton } from '@/components2024/CustomSkeleton';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { formatTokenAmount, formatUsdValue } from '@/utils/number';
import IconGasLevelChecked from '@/assets2024/icons/gas-account/check.svg';
import type { GasTokenInfo, TempoFeeTokenOption } from '@/utils/tempo';

export const formatTempoGasTokenAmount = (token: TempoFeeTokenOption) => {
  const amount =
    typeof token.amount === 'number'
      ? new BigNumber(token.amount)
      : new BigNumber(token.raw_amount_hex_str || 0, 16).div(
          new BigNumber(10).pow(token.decimals || 18),
        );

  return formatTokenAmount(amount.toString(10), 4, true);
};

const formatTempoGasTokenUsdValue = (token: TempoFeeTokenOption) => {
  if (typeof token.usd_value === 'number') {
    return formatUsdValue(token.usd_value);
  }

  const amount =
    typeof token.amount === 'number'
      ? new BigNumber(token.amount)
      : new BigNumber(token.raw_amount_hex_str || 0, 16).div(
          new BigNumber(10).pow(token.decimals || 18),
        );

  return formatUsdValue(amount.times(token.price || 0).toString(10));
};

export const TempoGasTokenSelectSheet = ({
  visible,
  gasToken,
  tokenList,
  loading,
  onClose,
  onSelect,
}: {
  visible: boolean;
  gasToken?: GasTokenInfo;
  tokenList: TempoFeeTokenOption[];
  loading?: boolean;
  onClose: () => void;
  onSelect?: (token: TempoFeeTokenOption) => void;
}) => {
  const { styles } = useTheme2024({ getStyle });
  const sheetRef = React.useRef<BottomSheetModal>(null);

  React.useEffect(() => {
    if (visible) {
      requestAnimationFrame(() => {
        sheetRef.current?.present();
      });
      return;
    }

    sheetRef.current?.dismiss();
  }, [visible]);

  const selectToken = React.useCallback(
    (token: TempoFeeTokenOption) => {
      if (token.isDisabledByTempoGasBalance) {
        return;
      }

      onSelect?.(token);
      onClose();
    },
    [onClose, onSelect],
  );

  return (
    <AppBottomSheetModal
      ref={sheetRef}
      snapPoints={['45%']}
      enableDismissOnClose
      onDismiss={onClose}>
      <View style={styles.content}>
        <Text style={styles.title}>Gas token</Text>
        <BottomSheetScrollView contentContainerStyle={styles.list}>
          {loading && !tokenList.length ? (
            <>
              <CustomSkeleton style={styles.skeletonRow} />
              <CustomSkeleton style={styles.skeletonRow} />
              <CustomSkeleton style={styles.skeletonRow} />
            </>
          ) : (
            tokenList.map(token => {
              const selected =
                gasToken?.tokenId?.toLowerCase() === token.id.toLowerCase();
              const disabled = !!token.isDisabledByTempoGasBalance;
              const symbol =
                token.display_symbol || token.optimized_symbol || token.symbol;

              return (
                <TouchableOpacity
                  key={token.id}
                  disabled={disabled}
                  style={[
                    styles.tokenItem,
                    selected && styles.tokenItemActive,
                    disabled && styles.tokenItemDisabled,
                  ]}
                  onPress={() => selectToken(token)}>
                  <View style={styles.tokenInfo}>
                    <AssetAvatar size={24} logo={token.logo_url} />
                    <Text
                      style={[
                        styles.tokenSymbol,
                        disabled && styles.tokenTextDisabled,
                      ]}
                      numberOfLines={1}>
                      {symbol}
                    </Text>
                  </View>
                  <View style={styles.tokenValue}>
                    <View style={styles.tokenValueColumn}>
                      <Text
                        style={[
                          styles.tokenUsdValue,
                          disabled && styles.tokenTextDisabled,
                        ]}
                        numberOfLines={1}>
                        {formatTempoGasTokenUsdValue(token)}
                      </Text>
                      <Text
                        style={[
                          styles.tokenAmount,
                          disabled && styles.tokenTextDisabled,
                        ]}
                        numberOfLines={1}>
                        {formatTempoGasTokenAmount(token)}
                      </Text>
                    </View>
                    {selected ? <IconGasLevelChecked /> : null}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </BottomSheetScrollView>
      </View>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 16,
  },
  list: {
    gap: 8,
    paddingBottom: 20,
  },
  skeletonRow: {
    height: 56,
    borderRadius: 8,
  },
  tokenItem: {
    minHeight: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: colors2024['neutral-line'],
    backgroundColor: colors2024['neutral-bg-2'],
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tokenItemActive: {
    borderColor: colors2024['brand-default'],
    backgroundColor: colors2024['brand-light-1'],
  },
  tokenItemDisabled: {
    opacity: 0.45,
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    paddingRight: 12,
  },
  tokenSymbol: {
    color: colors2024['neutral-title-1'],
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  tokenValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  tokenValueColumn: {
    alignItems: 'flex-end',
  },
  tokenUsdValue: {
    color: colors2024['neutral-title-1'],
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  tokenAmount: {
    color: colors2024['neutral-info'],
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 16,
  },
  tokenTextDisabled: {
    color: colors2024['neutral-foot'],
  },
}));

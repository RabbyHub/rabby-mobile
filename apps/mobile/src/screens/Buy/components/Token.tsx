import { useTheme2024 } from '@/hooks/theme';
import { formatSpeicalAmount, formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TextInput } from 'react-native';
import IconUSLogo from '@/assets2024/icons/buy/us.svg';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import TokenSelect from '@/screens/Swap/components/TokenSelect';
import { SWAP_SUPPORT_CHAINS } from '@/constant/swap';
import BigNumber from 'bignumber.js';

export const BuyToken = ({
  type,
  value,
  onInputChange,
  logo,
  currency,
  token,
  loading,
  onTokenSelect,
}: {
  type: 'from' | 'to';
  // from props
  value?: string;
  onInputChange?: (v: string) => void;
  logo?: string;
  currency?: string;

  // to props
  token?: TokenItem;
  loading?: boolean;
  onTokenSelect?: (token: TokenItem) => void;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const isPay = type === 'from';
  const isReceive = type === 'to';

  const openTokenModalRef = useRef<{
    openTokenModal: React.Dispatch<React.SetStateAction<boolean>>;
  }>(null);

  const handleTokenModalOpen = useCallback(() => {
    if (isReceive) {
      openTokenModalRef?.current?.openTokenModal?.(true);
    }
  }, [isReceive]);

  // const [value, setValue] = useState('');

  // const inputChange = React.useCallback((text: string) => {
  //   const v = formatSpeicalAmount(text);
  //   if (!/^\d*(\.\d*)?$/.test(v)) {
  //     return;
  //   }

  //   setValue(v);
  // }, []);

  return (
    <View style={styles.tokenBox}>
      <Text style={styles.label}>
        {isPay ? t('page.buy.youWillPay') : t('page.buy.youWillReceive')}
      </Text>
      <View style={styles.interfaceBox}>
        <TextInput
          numberOfLines={1}
          multiline={false}
          textAlign="left"
          keyboardType="numeric"
          inputMode="decimal"
          placeholderTextColor={colors2024['neutral-info']}
          style={styles.input}
          placeholder={'$0'}
          scrollEnabled={true}
          value={value?.toString()}
          onChangeText={onInputChange}
        />
        <View style={styles.divider} />

        {isPay && (
          <View style={styles.token}>
            <IconUSLogo />
            <Text style={styles.tokenText}>{currency}</Text>
          </View>
        )}

        {/* {isReceive && (
          <TokenSelect
            ref={openTokenModalRef}
            token={token}
            onTokenChange={onTokenSelect!}
            chainId={''}
            type={'swapFrom'}
            placeholder={t('page.swap.search-by-name-address')}
            // excludeTokens={excludeTokens}
            useSwapTokenList
            supportChains={SWAP_SUPPORT_CHAINS}
          />
        )} */}
      </View>

      {isReceive && (
        <Text style={styles.usdValue}>
          {formatUsdValue(
            new BigNumber(value || 0).times(token?.price || 0).toString(10),
          )}
        </Text>
      )}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  tokenBox: {
    backgroundColor: colors2024['neutral-bg-2'],
    padding: 24,
    borderRadius: 20,
  },

  label: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 18,
  },

  interfaceBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 36,
    alignItems: 'center',
  },

  input: {
    flex: 1,
    paddingVertical: 0,
    paddingBottom: 0,
    textAlignVertical: 'center',
    justifyContent: 'center',
    color: colors2024['neutral-title-1'],
    fontSize: 28,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    // height: 36,
    lineHeight: 36,
    paddingLeft: 0,
    borderWidth: 0,
    overflow: 'hidden',
  },

  divider: {
    marginHorizontal: 12,
    borderWidth: 0,
    borderLeftWidth: 1,
    width: 0,
    height: 27,
    borderColor: colors2024['neutral-line'],
  },

  token: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 20,
    backgroundColor: colors2024['neutral-line'],
  },
  tokenText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },
  usdValue: {
    marginTop: 8,
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 18,
  },
}));

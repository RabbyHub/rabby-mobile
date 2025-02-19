import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import IconCheckedBg from '@/assets2024/icons/buy/check-bg.svg';
import IconCheckedCC from '@/assets2024/icons/buy/check-cc.svg';
import React from 'react';
import IconArrowRightCC from '@/assets2024/icons/common/arrow-right-cc.svg';
import { formatTokenAmount } from '@/utils/number';
import { TouchableOpacity } from 'react-native';
import { Image } from 'react-native';
import { openapi } from '@/core/request';

export const BuyQuoteItem = ({
  id,
  name,
  logo,
  amount,
  symbol,
  activeProvider,
  setActiveProvider,
  isBest,
  payments,
}: {
  id: string;
  name: string;
  logo: string;
  amount: number;
  symbol: string;
  activeProvider: string;
  isBest?: boolean;
  setActiveProvider: (s: string) => void;
  payments?: Awaited<ReturnType<typeof openapi.getBuyPaymentMethods>>;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const active = React.useMemo(
    () => activeProvider === id,
    [activeProvider, id],
  );

  console.log('payments', payments);

  return (
    <TouchableOpacity
      style={[styles.container, active && styles.active]}
      onPress={() => {
        setActiveProvider(id);
      }}>
      {isBest && (
        <View style={styles.bestQuote}>
          <Text style={styles.bestQuoteText}>{t('page.buy.quote.best')}</Text>
        </View>
      )}

      {active && (
        <>
          <IconCheckedBg style={styles.checkBg} />
          <IconCheckedCC
            style={styles.check}
            color={colors2024['neutral-InvertHighlight']}
          />
        </>
      )}
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <View style={[styles.row, { gap: 8 }]}>
          <Image source={{ uri: logo }} style={styles.logo} />
          {/* <Skeleton style={styles.logo} /> */}
          <Text style={styles.name}>{name}</Text>
        </View>
        <Text style={styles.amount}>
          {formatTokenAmount(amount)} {symbol}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <View style={styles.payList}>
          {payments?.map((item, index) => (
            <View
              key={index}
              style={[styles.payBox, active && styles.payBoxActive]}>
              <Text>{item.name}</Text>
            </View>
          ))}
        </View>
        <IconArrowRightCC
          color={colors2024['neutral-secondary']}
          width={18}
          height={18}
        />
      </View>
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors2024['neutral-line'],
    padding: 16,
    paddingTop: 24,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },

  active: {
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors2024['green-default'],
    backgroundColor: colors2024['green-light-4'],
    padding: 16,
    paddingTop: 24,
    overflow: 'hidden',
  },

  checkBg: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  check: {
    position: 'absolute',
    top: 4,
    right: 22,
  },

  bestQuote: {
    overflow: 'hidden',
    position: 'absolute',
    left: 16,
    top: 0,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: colors2024['green-light-4'],
  },
  bestQuoteText: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 16,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  name: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 22,
  },

  amount: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 18,
  },

  logo: {
    width: 26,
    height: 26,
    borderRadius: 999999,
  },

  quoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  divider: {
    width: '100%',
    height: 1,
    backgroundColor: colors2024['neutral-line'],
    marginVertical: 12,
  },
  payList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payBox: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors2024['neutral-line'],
  },
  payBoxActive: {
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors2024['green-light-1'],
  },
  payName: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro',
    fontSize: 10,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 16,
  },
}));

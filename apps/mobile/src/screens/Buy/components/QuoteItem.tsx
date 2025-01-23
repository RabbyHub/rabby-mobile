import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Skeleton } from '@rneui/themed';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import IconCheckedBg from '@/assets2024/icons/buy/check-bg.svg';
import IconCheckedCC from '@/assets2024/icons/buy/check-cc.svg';
import React from 'react';
import { ListItem } from '@/components2024/ListItem/ListItem';
import IconArrowRightCC from '@/assets2024/icons/common/arrow-right-cc.svg';

export const BuyQuoteItem = () => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const quoteName = 'QuoteName';

  const quoteAmount = '0.254';

  const symbol = 'ETH';

  const active = true;

  const isBest = true;

  const payMethodList = Array.from({ length: 4 }).fill(1);

  return (
    <View
      style={[styles.container, active && styles.active]}
      needsOffscreenAlphaCompositing>
      {isBest && (
        <View style={styles.bestQuote} needsOffscreenAlphaCompositing>
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
          {/* <Image source={require('@/assets/images/quote.png')}  style={styles.logo}/> */}
          <Skeleton style={styles.logo} />
          <Text style={styles.name}>{quoteName}</Text>
        </View>
        <Text style={styles.amount}>
          {quoteAmount} {symbol}
        </Text>
      </View>

      <View style={styles.divider} needsOffscreenAlphaCompositing />

      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <View style={styles.payList}>
          {payMethodList.map((_, index) => (
            <View
              // key={}
              style={styles.payBox}>
              {/* <Image source={}  style={styles.payLogo}/> */}
              {/* <Skeleton style={styles.payLogo} /> */}
            </View>
          ))}
        </View>
        <IconArrowRightCC
          color={colors2024['neutral-secondary']}
          width={18}
          height={18}
        />
      </View>
    </View>
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
  },

  active: {
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors2024['green-default'],
    overflow: 'hidden',
    backgroundColor: colors2024['green-light-4'],
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
    width: 46,
    height: 20,
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
  },
}));

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
import RcTipCC from '@/assets2024/icons/common/tips.svg';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';

const paymentMethodsLogo = {
  REVOLUT_PAY: require('../images/revolut-pay.png'),
  BINANCE_CASH_BALANCE: require('../images/binance-pay.png'),
  BINANCE_P2P: require('../images/binance-pay.png'),
  PAYPAL: require('../images/paypal.png'),
  APPLE_PAY: require('../images/apple-pay.png'),
  QRPH: require('../images/ach.png'),
  ACH: require('../images/ach.png'),
  GOOGLE_PAY: require('../images/google-pay.png'),
  SAME_DAY_ACH: require('../images/ach.png'),
  CREDIT_DEBIT_CARD: require('../images/card.png'),
  other: require('../images/other.png'),
};

const getPaymentMethodLogo = (paymentMethod: string) => {
  if (paymentMethodsLogo[paymentMethod]) {
    return paymentMethodsLogo[paymentMethod];
  }
  return paymentMethodsLogo.other;
};

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

  const showPaymentTips = (paymentMethods?: typeof payments) => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.DESCRIPTION,
      title: t('page.buy.paymentMethod'),
      sections: [],
      content: (
        <>
          <View style={styles.paymentTipsBox}>
            <RcTipCC
              color={colors2024['neutral-info']}
              style={{ position: 'relative', top: 2 }}
            />
            <Text style={styles.paymentTipsDesc}>
              {t('page.buy.paymentProviderTips')}
            </Text>
          </View>

          <View style={styles.payList}>
            {paymentMethods?.map((item, index) => (
              <View key={index} style={[styles.payBox]}>
                <Image
                  source={getPaymentMethodLogo(item.id)}
                  style={{
                    width: 53.257,
                    height: 23.155,
                  }}
                  resizeMode="center"
                />
              </View>
            ))}
          </View>
        </>
      ),
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        enableDismissOnClose: true,
        snapPoints: ['40%'],
      },
      nextButtonProps: {
        title: (
          <Text style={styles.closeModalBtnText}>
            {t('page.tokenDetail.excludeBalanceTipsButton')}
          </Text>
        ),
        titleStyle: styles.title,
        onPress: () => {
          removeGlobalBottomSheetModal2024(modalId);
        },
      },
    });
  };

  return (
    <TouchableOpacity
      style={[styles.container, active && styles.active]}
      onPress={() => {
        setActiveProvider(id);
        console.log('345');
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

      <TouchableOpacity
        onPress={e => {
          e.stopPropagation();
          showPaymentTips(payments);
        }}
        style={[styles.row, { justifyContent: 'space-between' }]}>
        <View style={styles.payList}>
          {payments?.map((item, index) => (
            <View key={index} style={[styles.payBox]}>
              <Image
                source={getPaymentMethodLogo(item.id)}
                style={{
                  width: 46,
                  height: 20,
                }}
                resizeMode="center"
              />
            </View>
          ))}
        </View>
        <IconArrowRightCC
          color={colors2024['neutral-secondary']}
          width={18}
          height={18}
        />
      </TouchableOpacity>
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
    flexWrap: 'wrap',
  },
  payBox: {
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
    borderColor: colors2024['green-default-light'],
  },
  payName: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro',
    fontSize: 10,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 16,
  },

  title: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    lineHeight: 24,
  },
  closeModalBtnText: {
    fontSize: 20,
    color: colors2024['neutral-InvertHighlight'],
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  paymentTipsBox: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 20,
    marginBottom: 12,
  },
  paymentTipsDesc: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 20,
    textAlign: 'left',
  },
}));

import { AssetAvatar } from '@/components/AssetAvatar';
import { SwapItem } from '@rabby-wallet/rabby-api/dist/types';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { CommonHistoryItem } from './CommonHistoryItem';
import { getTokenAmountText } from './getTokenAmountText';
import BuyWalletSVG from '@/assets2024/icons/swap/buy-wallet.svg';
import { Text, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import ArrowRightCC from '@/assets2024/icons/common/arrow-right-cc.svg';
import { formatPrice } from '@/utils/number';

interface Props {
  /**
   * @todo maybe need to change the type
   */
  data: SwapItem;
}

/**
 * @todo add buy history
 */
export const BuyHistoryItem: React.FC<Props> = ({ data }) => {
  const { t } = useTranslation();
  const isPending = data.status === 'Pending';
  const { styles, colors2024 } = useTheme2024({ getStyle });

  return (
    <CommonHistoryItem
      icon={
        <View style={styles.iconContainer}>
          <BuyWalletSVG style={styles.walletIcon} />
          <AssetAvatar logo={data.pay_token.logo_url} size={46} />
        </View>
      }
      title={t('page.buy.purchased')}
      subTitle={
        <View style={styles.subTitleContainer}>
          <Text style={styles.subTitleText}>
            {t('page.buy.from', {
              /**
               * @todo
               */
              dex: 'Moonpay',
            })}
          </Text>
          <ArrowRightCC
            style={styles.arrowIcon}
            width={14}
            height={14}
            color={colors2024['neutral-secondary']}
          />
        </View>
      }
      isPending={isPending}
      rightContainer={
        isPending ? (
          <View style={styles.rightContainer}>
            <Text numberOfLines={1} style={styles.rightText}>
              {'-$' +
                formatPrice(
                  data.actual.pay_token_amount * data.pay_token.price,
                )}
            </Text>
          </View>
        ) : null
      }
      payTokenAmount={
        isPending
          ? null
          : '+' +
            getTokenAmountText({
              amount: data.actual.pay_token_amount,
              token: data.pay_token,
            })
      }
      receiveTokenAmount={
        isPending
          ? null
          : '-$' +
            formatPrice(data.actual.pay_token_amount * data.pay_token.price)
      }
    />
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  iconContainer: {
    position: 'relative',
  },
  arrowIcon: {
    marginLeft: 2,
    marginTop: 2,
  },
  walletIcon: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    zIndex: 1,
  },
  subTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subTitleText: {
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  rightContainer: {
    flex: 1,
    alignItems: 'flex-end',
    height: '100%',
  },
  rightText: {
    color: colors2024['neutral-body'],
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
}));

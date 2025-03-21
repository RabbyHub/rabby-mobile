import { AssetAvatar } from '@/components/AssetAvatar';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CommonHistoryItem } from './CommonHistoryItem';
import { getTokenAmountText } from './getTokenAmountText';
import BuyWalletSVG from '@/assets2024/icons/swap/buy-wallet.svg';
import BuyWalletDarkSVG from '@/assets2024/icons/swap/buy-wallet-dark.svg';

import { Text, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
// import ArrowRightCC from '@/assets2024/icons/common/arrow-right-cc.svg';
import { formatUsdValue } from '@/utils/number';
import { openapi } from '@/core/request';
import { usePendingBuyItemData } from '@/screens/Buy/hooks/history';
import { makeThemeIcon } from '@/hooks/makeThemeIcon';

const BuyWalletIcon = makeThemeIcon(BuyWalletSVG, BuyWalletDarkSVG);

interface Props {
  data: Awaited<ReturnType<typeof openapi.getBuyHistory>>['histories'][number];
}

/**
 * @todo add buy history
 */
export const BuyHistoryItem: React.FC<Props> = ({ data: _data }) => {
  const { t } = useTranslation();

  const { styles, isLight } = useTheme2024({ getStyle });

  const fetchedData = usePendingBuyItemData(
    _data.user_addr,
    _data.id,
    _data.status,
  );

  const data = useMemo(() => {
    if (fetchedData) {
      return fetchedData;
    }
    return _data;
  }, [_data, fetchedData]);

  const isPending = data.status === 'pending';
  const isFailed = data.status === 'failed';

  return (
    <CommonHistoryItem
      icon={
        <View style={styles.iconContainer}>
          <BuyWalletIcon style={styles.walletIcon} />
          <AssetAvatar logo={data.receive_token.logo_url} size={46} />
        </View>
      }
      title={t('page.buy.purchased')}
      subTitle={
        <View style={styles.subTitleContainer}>
          <Text style={styles.subTitleText}>
            {t('page.buy.from', {
              dex: data?.service_provider?.name,
            })}
          </Text>
          {/* <ArrowRightCC
            style={styles.arrowIcon}
            width={14}
            height={14}
            color={colors2024['neutral-secondary']}
          /> */}
        </View>
      }
      isPending={isPending}
      isFailed={isFailed}
      rightContainer={
        isPending ? (
          <View style={styles.rightContainer}>
            <Text numberOfLines={1} style={styles.rightText}>
              {'-' + formatUsdValue(data.pay_usd_amount)?.replace('$', '')}{' '}
              {data.pay_currency_code || ''}
            </Text>
          </View>
        ) : null
      }
      payTokenAmount={
        isPending
          ? null
          : '+' +
            getTokenAmountText({
              amount: data.receive_token.amount,
              token: data.receive_token,
            })
      }
      receiveTokenAmount={
        isPending ? null : (
          <Text style={styles.rightBottomText}>
            {`-${formatUsdValue(data.pay_usd_amount)?.replace('$', '')} ${
              data.pay_currency_code || ''
            }`}
          </Text>
        )
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

  rightBottomText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    textAlign: 'right',
    fontFamily: 'SF Pro Rounded',
  },
}));

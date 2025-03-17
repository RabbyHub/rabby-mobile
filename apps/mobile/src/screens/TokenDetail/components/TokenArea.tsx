import { AssetAvatar, Text } from '@/components';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { useTheme2024 } from '@/hooks/theme';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { createGetStyles2024 } from '@/utils/styles';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, TouchableOpacity, View } from 'react-native';
import { TokenFromAddressItem } from '..';
import { formatAmount, formatNumber, formatUsdValue } from '@/utils/number';
import { CombineTokensItem } from '@/screens/Home/hooks/store';

interface Props {
  token: AbstractPortfolioToken | CombineTokensItem;
  tokenUsdValue?: number;
  amountList: TokenFromAddressItem[];
  tokenSupportSwap: boolean;
  handleSwap: (
    type: 'Buy' | 'Sell',
    address: string,
    accountType: KEYRING_TYPE,
  ) => void;
}

export const TokenArea: React.FC<Props> = ({
  token,
  amountList,
  handleSwap,
  tokenSupportSwap,
  tokenUsdValue,
}) => {
  const { styles, isLight } = useTheme2024({ getStyle: getStyles });

  const { t } = useTranslation();

  const amountSum = useMemo(() => {
    // let sum = 0;
    // amountList.map((item, index) => {
    //   sum = sum + item.amount;
    // });
    if ('totalAmount' in token) {
      return token.totalAmount as unknown as number;
    } else {
      return token.amount;
    }
  }, [token]);

  const renderItem = useCallback(
    ({ item, index }: { item: TokenFromAddressItem; index: number }) => {
      return (
        <View style={styles.itemCard} key={index}>
          <View style={styles.tokenBox}>
            <Text style={styles.tokenAmount} numberOfLines={1}>
              {item.amountStr} {token.symbol}
            </Text>
            <View style={styles.accountBox}>
              <View className="relative">
                <WalletIcon
                  type={item?.type as KEYRING_TYPE}
                  width={styles.walletIcon.width}
                  height={styles.walletIcon.height}
                  style={styles.walletIcon}
                />
              </View>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={styles.titleText}>
                {item?.aliasName}
              </Text>
            </View>
          </View>
          <View style={styles.actionBox}>
            {tokenSupportSwap && (
              <>
                <TouchableOpacity
                  onPress={() => handleSwap('Sell', item.address, item.type)}>
                  <Text style={styles.actionText}>{t('page.swap.title')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      );
    },
    [
      tokenSupportSwap,
      handleSwap,
      styles.accountBox,
      styles.actionBox,
      styles.actionText,
      styles.itemCard,
      styles.titleText,
      styles.tokenAmount,
      styles.tokenBox,
      styles.walletIcon,
      t,
      token.symbol,
    ],
  );

  const ImageSrc = React.useMemo(() => {
    return !isLight
      ? require('@/assets2024/images/ImgNoBalanceDark.png')
      : require('@/assets2024/images/ImgNoBalance.png');
  }, [isLight]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.balanceTitle}>
          {t('page.tokenDetail.Mybalance')}
        </Text>
      </View>
      {amountList.length ? (
        <View style={styles.itemCard}>
          <AssetAvatar
            logo={token?.logo_url}
            // style={mediaStyle}
            size={46}
            chain={token?.chain}
            chainSize={18}
          />
          <View style={styles.tokenBox}>
            <Text style={styles.tokenAmount} numberOfLines={1}>
              {formatAmount(amountSum)} {token.symbol}
            </Text>
            <Text style={styles.tokenUsd}>
              {tokenUsdValue
                ? `≈ ${formatUsdValue(tokenUsdValue * amountSum)}`
                : ''}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.itemEmptyContainer}>
          <View style={styles.horizontalLine} />
          <Text style={styles.noBalanceText}>
            {t('page.tokenDetail.noBalance')}
          </Text>
          <View style={styles.horizontalLine} />
        </View>
      )}
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    width: '100%',
    // marginTop: 30,
    paddingHorizontal: 20,
    // marginBottom: 16,
  },
  horizontalLine: {
    // width: 1,
    flex: 1,
    height: 1,
    backgroundColor: ctx.colors2024['neutral-line'],
    // marginHorizontal: 4,
  },
  imgIcon: {
    width: 160,
    height: 116,
  },
  empytContainer: {
    paddingVertical: 40,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noBalanceText: {
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    textAlign: 'center',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
    marginBottom: 4,
  },
  accountBox: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 4,
  },
  titleText: {
    flexShrink: 1,
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    flexWrap: 'nowrap',
  },

  walletIcon: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },

  body: {},
  balanceTitle: {
    color: ctx.colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },

  itemCard: {
    marginTop: 12,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-1']
      : ctx.colors2024['neutral-bg-2'],
    borderRadius: 16,
    // borderColor: ctx.colors2024['neutral-line'],
    // borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemEmptyContainer: {
    marginTop: 12,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-1']
      : ctx.colors2024['neutral-bg-2'],
    borderRadius: 16,
    // borderColor: ctx.colors2024['neutral-line'],
    // borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    width: '100%',
    gap: 8,
    alignItems: 'center',
  },
  tokenBox: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    // gap: 4,
    flex: 1,
  },
  actionBox: {
    display: 'flex',
    flexDirection: 'row',
    width: 100,
    gap: 8,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  actionText: {
    color: ctx.colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  tokenUsd: {
    color: ctx.colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  tokenAmount: {
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
  },
}));

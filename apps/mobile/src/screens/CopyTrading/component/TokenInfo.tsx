import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  CopyTradeTokenItemV2,
  TokenItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { TokenPriceChart } from '@/screens/TokenDetail/components/TokenPriceChart';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useMemoizedFn } from 'ahooks';
import { openapi } from '@/core/request';
import RcIconJumpCC from '@/assets2024/icons/history/IconJumpCC.svg';
import { openTxExternalUrl } from '@/utils/transaction';
import { ellipsisAddress } from '@/utils/address';
import { findChain } from '@/utils/chain';
import { useTranslation } from 'react-i18next';
import { ellipsisOverflowedText } from '@/utils/text';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { formatUsdValueKMB } from '@/screens/Home/utils/price';
import dayjs from 'dayjs';
import { TokenMetaInfo } from './TokenMetaInfo';
import { QueryCopyTradingBuyItemResult } from '@/databases/entities/copyTradingBuyItem';
import { formatUsdValueKMBWithSign } from '@/screens/Home/utils/price';
interface TokenInfoProps {
  tradingTokenItem: CopyTradeTokenItemV2 | TokenItem;
  currentTokenProfitData?: QueryCopyTradingBuyItemResult;
  onUpChange: (isUp: boolean) => void;
}

export const TokenInfo: React.FC<TokenInfoProps> = ({
  tradingTokenItem,
  onUpChange,
  currentTokenProfitData,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const isContractToken = React.useMemo(() => {
    return /^0x.{40}/.test(tradingTokenItem.id);
  }, [tradingTokenItem]);

  const chainItem = React.useMemo(() => {
    return findChain({ serverId: tradingTokenItem.chain });
  }, [tradingTokenItem]);

  const { t } = useTranslation();

  const createdTime = React.useMemo(() => {
    const time =
      (tradingTokenItem as CopyTradeTokenItemV2).token_create_at ||
      tradingTokenItem.time_at;
    if (time) {
      return dayjs(time * 1000).format('YYYY/MM/DD HH:mm');
    } else {
      return '';
    }
  }, [tradingTokenItem]);

  const liquidity = (tradingTokenItem as CopyTradeTokenItemV2).liquidity;

  const fdvValue = (tradingTokenItem as CopyTradeTokenItemV2).fdv;

  const TokenMetaExtraInfo = React.useMemo(() => {
    if ('token_create_at' in tradingTokenItem) {
      return (
        <TokenMetaInfo
          tokenCreateAt={
            (tradingTokenItem as CopyTradeTokenItemV2).token_create_at ||
            tradingTokenItem.time_at
          }
          fdv={(tradingTokenItem as CopyTradeTokenItemV2).fdv || undefined}
          containerStyle={styles.tokenMetaInfo}
        />
      );
    } else {
      return null;
    }
  }, [tradingTokenItem, styles]);

  const EarningsDom = React.useMemo(() => {
    if (!currentTokenProfitData) {
      return null;
    }

    const costValue =
      currentTokenProfitData?.realAmount * currentTokenProfitData?.buy_price;

    const profit = currentTokenProfitData?.holdingUsdValue - costValue;

    const isPositive = profit >= 0;

    return (
      <View
        style={[
          styles.totalEarningsContainer,
          {
            backgroundColor: isPositive
              ? colors2024['green-light-4']
              : colors2024['neutral-bg-5'],
          },
        ]}>
        <Text style={styles.totalEarningsLabel}>
          {`${t('page.copyTrading.myBalanceFromCopyTrading')}: `}
        </Text>
        <View style={styles.totalEarningsRow}>
          <Text style={styles.totalValue}>
            {formatUsdValueKMB(currentTokenProfitData?.holdingUsdValue)}
          </Text>
          {profit !== 0 && (
            <Text
              style={[
                styles.totalProfit,
                {
                  color: isPositive
                    ? colors2024['green-default']
                    : colors2024['red-default'],
                },
              ]}>
              {`(${formatUsdValueKMBWithSign(profit)})`}
            </Text>
          )}
        </View>
      </View>
    );
  }, [currentTokenProfitData, styles, colors2024, t]);

  return (
    <ScrollView style={styles.container}>
      {EarningsDom}
      <TokenPriceChart
        token={ensureAbstractPortfolioToken(tradingTokenItem)}
        originToken={ensureAbstractPortfolioToken(tradingTokenItem)}
        amountList={[]}
        extraMetaInfo={TokenMetaExtraInfo}
        onUpChange={onUpChange}
      />
      <View style={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('page.tokenDetail.Info')}</Text>
        </View>
        <View style={styles.itemCard}>
          {Boolean(createdTime) && (
            <View style={styles.itemContainer}>
              <Text style={styles.titleText}>
                {t('page.copyTrading.createdTime')}
              </Text>
              <View style={styles.token}>
                <Text style={[styles.contentText]}>{createdTime}</Text>
              </View>
            </View>
          )}
          <View style={styles.itemContainer}>
            <Text style={styles.titleText}>
              {t('page.tokenDetail.TokenName')}
            </Text>
            <View style={styles.token}>
              <Text
                style={[styles.contentText]}
                numberOfLines={1}
                ellipsizeMode="tail">
                {ellipsisOverflowedText(tradingTokenItem.name || '', 25)}
              </Text>
            </View>
          </View>
          <View style={styles.itemContainer}>
            <Text style={styles.titleText}>{t('page.sendToken.Chain')}</Text>
            <View style={styles.token}>
              <ChainIconImage
                size={16}
                chainServerId={tradingTokenItem.chain}
                isShowRPCStatus={true}
              />
              <Text
                style={[styles.contentText]}
                numberOfLines={1}
                ellipsizeMode="tail">
                {chainItem?.name}
              </Text>
            </View>
          </View>
          {isContractToken && (
            <View style={styles.itemContainer}>
              <Text style={styles.titleText}>
                {t('page.sendToken.ContractAddress')}
              </Text>
              <View style={styles.token}>
                <Text
                  style={styles.contentText}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {ellipsisAddress(tradingTokenItem.id)}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    openTxExternalUrl({
                      chain: tradingTokenItem.chain,
                      address: tradingTokenItem.id,
                    });
                  }}>
                  <RcIconJumpCC
                    style={styles.icon}
                    color={colors2024['neutral-foot']}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}
          {Boolean(fdvValue) && (
            <View style={styles.itemContainer}>
              <Text style={styles.titleText}>{t('page.tokenDetail.fdv')}</Text>
              <View style={styles.token}>
                <Text
                  style={[styles.contentText]}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {fdvValue ? formatUsdValueKMB(fdvValue) : '-'}
                </Text>
              </View>
            </View>
          )}
          {Boolean(liquidity) && (
            <View style={styles.itemContainer}>
              <Text style={styles.titleText}>
                {t('page.copyTrading.Liquidity')}
              </Text>
              <View style={styles.token}>
                <Text style={[styles.contentText]}>
                  {liquidity ? formatUsdValueKMB(liquidity) : '-'}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    flex: 1,
    paddingTop: 16,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  token: {
    // display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  infoContainer: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors2024['neutral-line'],
  },
  totalEarningsContainer: {
    backgroundColor: colors2024['green-light'],
    flexDirection: 'row',
    alignItems: 'center',
    // justifyContent: 'space-between',
    padding: 12,
    borderRadius: 6,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  totalEarningsLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  totalEarningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  totalValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  totalProfit: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  value: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    maxWidth: 200,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
    paddingLeft: 4,
    marginBottom: 12,
  },
  itemCard: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderRadius: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    width: '100%',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  itemContainer: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  titleText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  contentText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  icon: {
    width: 14,
    height: 14,
  },
  tokenMetaInfo: {
    paddingLeft: 24,
  },
}));

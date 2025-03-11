import { AssetAvatar, Text } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { AbstractPortfolio, AbstractProject } from '@/screens/Home/types';
import { formatTokenAmount } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { RcIconRightCC } from '@/assets/icons/common';
import BigNumber from 'bignumber.js';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import { ellipsisOverflowedText } from '@/utils/text';
import { RelatedDeFiType } from '..';

interface Props {
  deFiList: RelatedDeFiType[];
  handleGoDeFi: (
    data: AbstractProject,
    itemList: AbstractPortfolio[],
    symbol: string,
  ) => void;
  symbol: string;
}

export const RelatedDeFi: React.FC<Props> = ({
  deFiList,
  handleGoDeFi,
  symbol,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const { t } = useTranslation();

  const renderItem = useCallback(
    ({ item, index }: { item: RelatedDeFiType; index: number }) => {
      return (
        <TouchableOpacity
          key={index}
          onPress={() =>
            handleGoDeFi(item, [...(item._portfolios || [])], symbol)
          }>
          <View style={styles.defiItem}>
            <View style={styles.defiItemContent}>
              <AssetAvatar
                logo={item?.logo}
                size={28}
                chain={item?.chain}
                chainSize={12}
              />
              <Text
                style={styles.defiItemText}
                numberOfLines={1}
                ellipsizeMode="tail">
                {/* {token?.name} */}
                {ellipsisOverflowedText(item?.name, 10)}
              </Text>
            </View>
            <View style={styles.defiItemContent}>
              <Text style={styles.defiItemText}>{`${formatTokenAmount(
                item?.amount,
              )} ${ellipsisOverflowedText(symbol, 6)}`}</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [
      handleGoDeFi,
      styles.defiItem,
      styles.defiItemContent,
      styles.defiItemText,
      symbol,
    ],
  );

  const handleOpenDeFiDetail = useCallback(() => {}, []);

  const hasMore = useMemo(() => deFiList?.length > 3, [deFiList]);

  const ListHeaderComponent = useCallback(() => {
    return (
      <View style={styles.historyHeader}>
        <Text style={styles.relateTitle}>{t('page.tokenDetail.Defi')}</Text>
        {hasMore && (
          <TouchableOpacity
            style={styles.rightContent}
            onPress={handleOpenDeFiDetail}>
            <Text style={styles.headerContent}>
              {t('page.tokenDetail.SeeMore')}
            </Text>
            <RcIconRightCC
              style={styles.arrowStyle}
              width={13}
              height={13}
              color={colors2024['neutral-secondary']}
            />
          </TouchableOpacity>
        )}
      </View>
    );
  }, [
    hasMore,
    handleOpenDeFiDetail,
    styles.rightContent,
    styles.relateTitle,
    styles.headerContent,
    styles.historyHeader,
    styles.arrowStyle,
    colors2024,
    t,
  ]);

  const sortedList = useMemo(
    () =>
      deFiList?.sort((a, b) =>
        new BigNumber(b.amount).comparedTo(new BigNumber(a.amount)),
      ),
    [deFiList],
  );

  return (
    <View style={styles.container}>
      {ListHeaderComponent()}
      {Boolean(sortedList.length) &&
        sortedList
          .slice(0, 3)
          .map((item, index) => renderItem({ item, index }))}
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 16,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
    marginBottom: 4,
  },
  defiItem: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // paddingVertical: 6,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-1']
      : ctx.colors2024['neutral-bg-2'],
    borderRadius: 16,
    // borderColor: ctx.colors2024['neutral-line'],
    // borderWidth: 1,
    padding: 16,
  },
  defiItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    // marginBottom: 16,
    // paddingHorizontal: 20,
    gap: 6,
  },
  relateTitle: {
    color: ctx.colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  rightContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  historyHeader: {
    // marginVertical: 12,
    // paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    marginLeft: 4,
  },
  defiItemText: {
    color: ctx.colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    marginLeft: 6,
  },
  arrowStyle: {
    marginTop: 0,
  },

  body: {},
  balanceTitle: {
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
  },

  itemCard: {
    marginTop: 12,
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    borderRadius: 16,
    borderColor: ctx.colors2024['neutral-line'],
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  tokenBox: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
  },
  actionBox: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
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
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '800',
  },
  tokenAmount: {
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
}));

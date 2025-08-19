import React, { useCallback, useEffect, useMemo } from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { RcArrowRight3CC } from '@/assets/icons/common';
import { useTheme2024 } from '@/hooks/theme';
import { HistoryDisplayItem } from '@/screens/Transaction/MultiAddressHistory';
import { HistoryItem } from '@/screens/Transaction/components/HistoryItem';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { HistoryItemEntity } from '@/databases/entities/historyItem';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { ensureHistoryListItemFromDb } from '@/screens/Transaction/components/utils';
import { useTranslation } from 'react-i18next';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { StackActions } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';

export const HistoryList = ({
  isForMultipleAddress,
  finalAccount,
  token,
  top10Addresses,
}: {
  finalAccount: KeyringAccountWithAlias | null;
  isForMultipleAddress: boolean;
  token: AbstractPortfolioToken;
  top10Addresses: string[];
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [data, setData] = React.useState<HistoryDisplayItem[]>([]);
  const { t } = useTranslation();
  const { navigation } = useSafeSetNavigationOptions();

  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

  const openHistory = useCallback(async () => {
    await switchSceneCurrentAccount('History', finalAccount);
    navigation.dispatch(
      StackActions.push(RootNames.StackTransaction, {
        screen: isForMultipleAddress
          ? RootNames.MultiAddressHistory
          : RootNames.History,
        params: {
          isInTokenDetail: true,
          tokenItem: token,
          isMultiAddress: isForMultipleAddress,
        },
      }),
    );
  }, [
    navigation,
    switchSceneCurrentAccount,
    finalAccount,
    isForMultipleAddress,
    token,
  ]);

  const fetchHistoryItem = useCallback(async () => {
    const addresses = isForMultipleAddress
      ? top10Addresses.map(a => a.toLowerCase())
      : [finalAccount?.address.toLowerCase()!];
    const [historyList] = await Promise.all([
      HistoryItemEntity.getTokenHistoryItemSortedByTime(
        addresses,
        token._tokenId,
        token.chain,
        4,
      ),
    ]);

    const list = historyList.map(item => {
      return {
        ...ensureHistoryListItemFromDb(item),
        isSmallUsdTx: false,
        isShowSuccess: false,
      } as HistoryDisplayItem;
    });
    setData(list);
  }, [
    finalAccount?.address,
    token._tokenId,
    token.chain,
    isForMultipleAddress,
    top10Addresses,
  ]);

  useEffect(() => {
    fetchHistoryItem();
  }, [fetchHistoryItem]);

  const hasMore = useMemo(() => data && data?.length > 3, [data]);

  const renderItem = useMemoizedFn(({ item }: { item: HistoryDisplayItem }) => {
    return (
      <HistoryItem
        key={`${item.address}-${item.id}`}
        data={item}
        isForMultipleAddress={isForMultipleAddress}
      />
    );
  });

  return (
    data.length > 0 && (
      <View style={styles.container}>
        <View style={styles.historyHeader}>
          <Text style={styles.relateTitle}>
            {t('page.tokenDetail.Transaction')}
          </Text>
          {hasMore && (
            <TouchableOpacity style={styles.rightContent} onPress={openHistory}>
              <Text style={styles.headerContent}>
                {t('page.tokenDetail.SeeMore')}
              </Text>
              <RcArrowRight3CC
                style={styles.arrowStyle}
                width={12}
                height={12}
                color={colors2024['neutral-secondary']}
              />
            </TouchableOpacity>
          )}
        </View>
        {Boolean(data.length) &&
          data.slice(0, 3).map(item => renderItem({ item }))}
      </View>
    )
  );
};

const getStyle = createGetStyles2024(ctx => ({
  container: {
    width: '100%',
    paddingHorizontal: 15,
    marginTop: 30,
    gap: 0,
  },
  bottomBg: {
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
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
  popupRelateTitle: {
    color: ctx.colors2024['neutral-title-1'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  relateTitle: {
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '700',
  },
  rightContent: {
    alignItems: 'center',
    flexDirection: 'row',
    padding: 4,
    paddingRight: 1,
  },
  historyHeader: {
    paddingLeft: 4,
    marginBottom: 12,
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

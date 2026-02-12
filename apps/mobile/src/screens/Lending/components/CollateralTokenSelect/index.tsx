import React, { useCallback, useMemo } from 'react';

import { useTranslation } from 'react-i18next';
import { Keyboard, Text, View } from 'react-native';

import AutoLockView from '@/components/AutoLockView';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';

import AssetItem from './AssetItem';
import { EmodeCategory } from '../../type';
import { useMode } from '../../hooks/useMode';
import { getCollateralTokens } from '../../utils/swap';
import { SwappableToken } from '../../types/swap';
import { useLendingSummary, useSelectedMarket } from '../../hooks';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import RcIconWarningCircleCC from '@/assets2024/icons/common/warning-circle-cc.svg';

export type EModeCategoryDisplay = EmodeCategory & {
  available: boolean; // indicates if the user can enter this category
};

interface IProps {
  excludeTokenAddress: string;
  onChange: (v: SwappableToken) => void;
}
const FOOTER_COMPONENT_HEIGHT = 32;

export default function CollateralTokenSelectModal({
  excludeTokenAddress,
  onChange,
}: IProps) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const { iUserSummary, displayPoolReserves } = useLendingSummary();
  const { eModes } = useMode();
  const { chainInfo, marketKey } = useSelectedMarket();

  const tokenToDisplay = useMemo(() => {
    return iUserSummary && chainInfo?.id && marketKey
      ? getCollateralTokens(iUserSummary, chainInfo?.id)
          .filter(
            item => !isSameAddress(item.underlyingAddress, excludeTokenAddress),
          )
          .map(item => {
            const displayPoolReserve = displayPoolReserves.find(
              x => x.underlyingAsset === item.underlyingAddress,
            );
            return {
              ...item,
              baseLTVasCollateral:
                displayPoolReserve?.reserve.baseLTVasCollateral,
              totalBorrowsUSD: displayPoolReserve?.totalBorrowsUSD,
              walletBalanceUSD: displayPoolReserve?.walletBalanceUSD,
              underlyingUsdValue:
                displayPoolReserve?.underlyingBalanceUSD || '0',
            };
          })
          .sort((a, b) => {
            if (
              Number(a.underlyingUsdValue) === 0 &&
              Number(b.underlyingUsdValue) === 0
            ) {
              return Number(b.balance) - Number(a.balance);
            }
            return Number(b.underlyingUsdValue) - Number(a.underlyingUsdValue);
          })
      : [];
  }, [
    iUserSummary,
    chainInfo?.id,
    marketKey,
    excludeTokenAddress,
    displayPoolReserves,
  ]);

  const hasLtvZeroCollateral = useMemo(() => {
    return tokenToDisplay
      .filter(
        item =>
          !!item.balance &&
          item.balance !== '0' &&
          item.usageAsCollateralEnabled,
      )
      .some(item => item.baseLTVasCollateral === '0');
  }, [tokenToDisplay]);

  const formatData = useMemo(() => {
    // 如果有ltv 为 0的抵押物，必须优先还款
    return hasLtvZeroCollateral
      ? tokenToDisplay.filter(item => item.baseLTVasCollateral === '0')
      : tokenToDisplay;
  }, [hasLtvZeroCollateral, tokenToDisplay]);

  const isDark = useGetBinaryMode() === 'dark';

  const ListHeaderComponent = useCallback(() => {
    return (
      <View>
        {hasLtvZeroCollateral && (
          <View style={styles.ltvZeroTipContainer}>
            <RcIconWarningCircleCC
              width={18}
              height={18}
              color={colors2024['orange-default']}
              style={styles.ltvZeroTipIcon}
            />
            <Text style={styles.ltvZeroTipText}>
              {t('page.Lending.repayWithAToken.zeroLtvCollateralTips')}
            </Text>
          </View>
        )}
        <View style={styles.headerContainer}>
          <Text style={[styles.headerText, styles.assetsHeaderText]}>
            {t('page.Lending.manageEmode.collateralSwapSelector.header.assets')}
          </Text>
          <Text style={[styles.headerText, styles.apyHeaderText]}>
            {t('page.Lending.apy')}
          </Text>
          <Text style={[styles.headerText, styles.borrowHeaderText]}>
            {t(
              'page.Lending.manageEmode.collateralSwapSelector.header.collateral',
            )}
          </Text>
        </View>
      </View>
    );
  }, [styles, t, colors2024, hasLtvZeroCollateral]);

  return (
    <AutoLockView
      style={{
        ...styles.container,
        backgroundColor: isDark
          ? colors2024['neutral-bg-1']
          : colors2024['neutral-bg-0'],
      }}>
      <BottomSheetHandlableView>
        <View style={{ ...styles.titleView, ...styles.titleViewWithText }}>
          <View style={styles.titleTextWrapper}>
            <Text style={styles.titleText}>
              {t('page.Lending.manageEmode.collateralSwapSelector.title')}
            </Text>
          </View>
        </View>
      </BottomSheetHandlableView>

      <View style={[styles.chainListWrapper]}>
        <BottomSheetFlatList<SwappableToken>
          data={formatData}
          onScrollBeginDrag={() => {
            Keyboard.dismiss();
          }}
          style={styles.flatList}
          ListFooterComponent={
            <View style={{ height: FOOTER_COMPONENT_HEIGHT }} />
          }
          ListHeaderComponent={ListHeaderComponent}
          keyExtractor={item => item.underlyingAddress.toString()}
          renderItem={({ item, index }) => {
            const isSectionFirst = index === 0;
            const isSectionLast =
              index === (Object.values(eModes)?.length || 0) - 1;
            return (
              <View
                style={[
                  isSectionFirst && styles.sectionFirst,
                  isSectionLast && styles.sectionLast,
                ]}>
                <AssetItem token={item} onPress={() => onChange(item)} />
              </View>
            );
          }}
        />
      </View>
    </AutoLockView>
  );
}

const RADIUS_VALUE = 24;

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    height: '100%',
    paddingHorizontal: 16,
  },
  searchBar: {
    flex: 1,
  },
  titleText: {
    color: colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    lineHeight: 24,
  },
  desc: {
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 24,
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    marginTop: 8,
  },
  titleTextWrapper: {
    flex: 1,
  },
  netSwitchTabs: {
    marginBottom: 20,
  },
  innerBlock: {
    paddingHorizontal: 0,
  },
  inputContainerStyle: {
    height: 46,
    borderRadius: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 0,
  },
  inputText: {
    color: colors2024['neutral-title-1'],
    marginLeft: 7,
    fontSize: 17,
    fontWeight: '400',
    paddingTop: 0,
    paddingBottom: 0,
    fontFamily: 'SF Pro Rounded',
  },

  chainListWrapper: {
    flexShrink: 1,
    height: '100%',
  },

  emptyDataWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    maxHeight: 400,
    // ...makeDebugBorder()
  },

  emptyText: {
    paddingTop: 21,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-info'],
  },

  titleView: {
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },

  inputWrapper: {
    marginRight: 15,
    flex: 1,
    overflow: 'hidden',
  },

  cancelText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 17,
    lineHeight: 22,
  },

  titleViewWithText: {
    marginBottom: 34,
  },

  iconSearch: {
    position: 'absolute',
    right: 4,
  },
  flatList: {
    paddingHorizontal: 0,
  },
  sectionFirst: {
    borderTopLeftRadius: RADIUS_VALUE,
    borderTopRightRadius: RADIUS_VALUE,
  },
  sectionLast: {
    borderBottomLeftRadius: RADIUS_VALUE,
    borderBottomRightRadius: RADIUS_VALUE,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  headerText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  assetsHeaderText: {
    flex: 1,
  },
  apyHeaderText: {
    width: 60,
    flex: 0,
  },
  borrowHeaderText: {
    flex: 0,
    marginLeft: 10,
    width: 80,
    textAlign: 'right',
  },
  ltvZeroTipContainer: {
    backgroundColor: colors2024['orange-light-1'],
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
  },
  ltvZeroTipText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['orange-default'],
    fontFamily: 'SF Pro Rounded',
    flexShrink: 1,
  },
  ltvZeroTipIcon: {
    position: 'relative',
    top: 1,
    flexShrink: 0,
  },
}));

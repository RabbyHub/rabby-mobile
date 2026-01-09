import React, { useCallback, useMemo } from 'react';

import { useTranslation } from 'react-i18next';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeTriangleStyle } from '@/utils/styles';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';

import TokenIcon from '../TokenIcon';
import IsolatedTag from '../IsolatedTag';
import { useLendingSummary, useSelectedMarket } from '../../hooks';
import { getSupplyCapData } from '../../utils/supply';
import { CollateralSwitch } from '../CollateralSwitch';
import { formatApy, formatListNetWorth } from '../../utils/format';
import { useToggleCollateralModal } from '../../modals/ToggleCollateralModal';
import { formatTokenAmount } from '@/utils/number';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import wrapperToken from '../../config/wrapperToken';

interface SupplyItemProps extends RNViewProps {
  underlyingAsset: string;
}

const SupplyItem: React.FC<SupplyItemProps> = ({ underlyingAsset, style }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const { t } = useTranslation();
  const { iUserSummary: userSummary, getTargetReserve } = useLendingSummary();
  const { openCollateralChange } = useToggleCollateralModal();
  const { chainEnum } = useSelectedMarket();
  const reserve = useMemo(() => {
    return getTargetReserve(underlyingAsset);
  }, [getTargetReserve, underlyingAsset]);

  const {
    isSupplied,
    apyText,
    suppliedUsdText,
    suppliedTokenText,
    isIsolated,
  } = useMemo(() => {
    if (!reserve) {
      return {
        isSupplied: false,
        apyText: '',
        suppliedUsdText: '',
        suppliedTokenText: '',
        isIsolated: false,
      };
    }
    const hasSupplied =
      !!reserve.underlyingBalanceUSD && reserve.underlyingBalanceUSD !== '0';

    const apy = formatApy(Number(reserve.reserve.supplyAPY || '0'));
    const suppliedUsd = formatListNetWorth(
      Number(reserve.underlyingBalanceUSD || '0'),
    );

    const tokenAmountNum = Number(reserve.underlyingBalance || '0');
    let tokenAmount = '';
    if (tokenAmountNum) {
      if (tokenAmountNum >= 1) {
        tokenAmount = tokenAmountNum.toFixed(4);
      } else {
        tokenAmount = tokenAmountNum.toPrecision(4);
      }
    } else {
      tokenAmount = '0';
    }

    return {
      isSupplied: hasSupplied,
      apyText: apy,
      suppliedUsdText: suppliedUsd,
      suppliedTokenText: `${formatTokenAmount(tokenAmount)} ${
        reserve.reserve.symbol
      }`,
      isIsolated: reserve.reserve.isIsolated,
    };
  }, [reserve]);

  const canBeEnabledAsCollateral = useMemo(() => {
    if (!reserve) {
      return false;
    }
    const { supplyCapReached } = getSupplyCapData(reserve);
    return userSummary
      ? !supplyCapReached &&
          reserve.reserve.reserveLiquidationThreshold !== '0' &&
          ((!reserve.reserve.isIsolated && !userSummary.isInIsolationMode) ||
            userSummary.isolatedReserve?.underlyingAsset ===
              reserve.underlyingAsset ||
            (reserve.reserve.isIsolated &&
              userSummary.totalCollateralMarketReferenceCurrency === '0'))
      : false;
  }, [reserve, userSummary]);

  const handleOpenSupplyDetail = useCallback(() => {
    if (!reserve || !userSummary) {
      return;
    }
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.SUPPLY_ACTION_DETAIL,
      reserve,
      userSummary,
      onClose: () => {
        removeGlobalBottomSheetModal2024(modalId);
      },
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        enableDismissOnClose: true,
        handleStyle: {
          backgroundColor: colors2024['neutral-bg-1'],
        },
      },
    });
  }, [colors2024, reserve, userSummary]);

  const handleOpenWithdrawDetail = useCallback(() => {
    if (!reserve || !userSummary) {
      return;
    }
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.WITHDRAW_ACTION_DETAIL,
      reserve,
      userSummary,
      onClose: () => {
        removeGlobalBottomSheetModal2024(modalId);
      },
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        enableDismissOnClose: true,
        handleStyle: {
          backgroundColor: colors2024['neutral-bg-1'],
        },
      },
    });
  }, [colors2024, reserve, userSummary]);

  const isWrapperToken = useMemo(() => {
    return chainEnum && reserve
      ? isSameAddress(
          wrapperToken[chainEnum]?.address,
          reserve.reserve.underlyingAsset,
        )
      : false;
  }, [chainEnum, reserve]);

  if (!reserve) {
    return null;
  }

  return (
    <View
      style={[styles.container, isWrapperToken && styles.wrapperToken, style]}>
      {isWrapperToken && <View style={styles.wrapperTokenArrow} />}
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.tokenInfo}>
            <TokenIcon
              size={46}
              chainSize={0}
              tokenSymbol={reserve?.reserve?.symbol || ''}
              chain={reserve?.chain}
            />
            <View style={styles.tokenTextArea}>
              <View style={styles.symbolArea}>
                <Text
                  style={styles.symbol}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {reserve.reserve.symbol}
                </Text>
                <View style={styles.apyTag}>
                  <Text style={styles.apyTagText}>{`Apy ${apyText}`}</Text>
                </View>
              </View>
              {isIsolated ? <IsolatedTag /> : null}
            </View>
          </View>
          <View style={styles.amountArea}>
            <Text style={styles.amountUsd}>{suppliedUsdText}</Text>
            <Text style={styles.amountToken} numberOfLines={1}>
              {suppliedTokenText}
            </Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <View style={styles.collateralArea}>
            <Text style={styles.collateralLabel}>
              {t('page.Lending.supplyOverview.collateral')}
            </Text>
            <CollateralSwitch
              reserve={reserve}
              canBeEnabledAsCollateral={canBeEnabledAsCollateral}
              onValueChange={() => {
                openCollateralChange(reserve);
              }}
            />
          </View>
          <TouchableOpacity
            style={styles.buttonSecondary}
            activeOpacity={0.8}
            onPress={handleOpenSupplyDetail}>
            <Text style={styles.buttonSecondaryText}>
              {t('page.Lending.supplyDetail.actions')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.buttonPrimary}
            activeOpacity={0.8}
            onPress={handleOpenWithdrawDetail}>
            <Text style={styles.buttonPrimaryText}>
              {t('page.Lending.withdrawDetail.actions')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {isSupplied ? (
        <View style={styles.suppliedBadge}>
          <Text style={styles.suppliedBadgeText}>
            {t('page.Lending.supplyDetail.supplied')}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

export default SupplyItem;

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    borderRadius: 16,
    paddingTop: 40,
    paddingBottom: 12,
    paddingHorizontal: 0,
    marginTop: 12,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.07,
        shadowRadius: 16,
        shadowOffset: {
          width: 0,
          height: 8,
        },
      },
      android: {
        elevation: 0,
      },
      default: {},
    }),
    position: 'relative',
  },
  wrapperToken: {
    backgroundColor: colors2024['neutral-bg-5'],
  },
  wrapperTokenArrow: {
    position: 'absolute',
    top: -14,
    left: 30,
    zIndex: 1,
    ...makeTriangleStyle({
      dir: 'up',
      size: 7,
      color: colors2024['neutral-bg-5'],
      backgroundColor: 'transparent',
    }),
  },
  content: {
    paddingHorizontal: 14,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  tokenTextArea: {
    flexDirection: 'column',
    gap: 4,
  },
  symbolArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  symbol: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  apyTag: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors2024['green-light-1'],
  },
  apyTagText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
  },
  isolatedTag: {
    paddingHorizontal: 4.8,
    paddingVertical: 2.8,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: colors2024['orange-light-2'],
    backgroundColor: colors2024['orange-light-1'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  isolatedTagText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['orange-default'],
    fontFamily: 'SF Pro Rounded',
  },
  amountArea: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  amountUsd: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  amountToken: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  collateralArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  collateralLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  buttonSecondary: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
  },
  buttonSecondaryText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  buttonPrimary: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024['brand-light-1'],
  },
  buttonPrimaryText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
  },
  suppliedBadge: {
    position: 'absolute',
    top: 9,
    left: 9,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors2024['green-default'],
  },
  suppliedBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors2024['neutral-InvertHighlight'],
    fontFamily: 'SF Pro Rounded',
  },
}));

import React, { useCallback, useMemo } from 'react';

import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
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
import { CollateralSwitch } from '../CollateralSwitch';
import { formatApy, formatListNetWorth } from '../../utils/format';
import { useToggleCollateralModal } from '../../modals/ToggleCollateralModal';
import { formatTokenAmount } from '@/utils/number';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import wrapperToken from '../../config/wrapperToken';
import { Text } from '@/components/Typography';
import { colord } from 'colord';
import { openLendingActionPopup } from '../../utils/actionPopup';
import { PositionTokenSelector } from './PositionTokenSelector';
import type {
  BasicPositionTokenOption,
  PositionTokenOption,
} from '../../utils/positionTokenSelector';

interface SupplyItemProps extends RNViewProps {
  underlyingAsset: string;
  activeUnderlyingAsset: string;
  tokenOptions?: PositionTokenOption[];
  onChangeActiveUnderlyingAsset: (underlyingAsset: string) => void;
}

const SupplyItem: React.FC<SupplyItemProps> = ({
  underlyingAsset,
  activeUnderlyingAsset,
  tokenOptions,
  onChangeActiveUnderlyingAsset,
  style,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const { t } = useTranslation();
  const { iUserSummary: userSummary, getTargetReserve } = useLendingSummary();
  const { openCollateralChange } = useToggleCollateralModal();
  const { chainEnum } = useSelectedMarket();
  const currentUnderlyingAsset =
    tokenOptions?.length && activeUnderlyingAsset
      ? activeUnderlyingAsset
      : underlyingAsset;

  const reserve = useMemo(() => {
    return getTargetReserve(currentUnderlyingAsset);
  }, [currentUnderlyingAsset, getTargetReserve]);

  const { apyText, suppliedUsdText, suppliedTokenText, isIsolated } =
    useMemo(() => {
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
    return userSummary
      ? reserve.reserve.reserveLiquidationThreshold !== '0' &&
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
    openLendingActionPopup({
      popup: 'supply',
      reserve,
      userSummary,
      colors2024,
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
  const shouldUseWrapperTokenStyle = isWrapperToken && !tokenOptions?.length;

  if (!reserve) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        shouldUseWrapperTokenStyle && styles.wrapperToken,
        style,
      ]}>
      {shouldUseWrapperTokenStyle && <View style={styles.wrapperTokenArrow} />}
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.tokenInfo}>
            <View style={styles.tokenInfoContainer}>
              <TokenIcon
                size={28}
                chainSize={0}
                tokenSymbol={reserve?.reserve?.symbol || ''}
                chain={reserve?.chain}
              />
              <View style={styles.tokenTextArea}>
                <View style={styles.symbolArea}>
                  <PositionTokenSelector
                    activeUnderlyingAsset={currentUnderlyingAsset}
                    options={tokenOptions as BasicPositionTokenOption[]}
                    symbol={reserve.reserve.symbol}
                    chain={reserve.chain}
                    onChange={onChangeActiveUnderlyingAsset}
                  />
                </View>
              </View>
            </View>
            <View style={styles.badgeContainer}>
              <View style={styles.suppliedBadge}>
                <Text style={styles.suppliedBadgeText}>
                  {t('page.Lending.supplyDetail.supplied')}
                </Text>
              </View>
              <View style={styles.apyTag}>
                <Text style={styles.apyTagText}>{`Apy ${apyText}`}</Text>
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
            style={styles.aaveButtonPrimary}
            activeOpacity={0.8}
            onPress={handleOpenWithdrawDetail}>
            <Text style={styles.aaveButtonPrimaryText}>
              {t('page.Lending.withdrawDetail.actions')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default SupplyItem;

const getStyle = createGetStyles2024(({ colors2024, isLight }) => {
  const cardBgColor = colors2024['neutral-bg-2'];
  const wrapperTokenCardBgColor = colord(cardBgColor).alpha(0.5).toRgbString();

  return {
    container: {
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 0,
      marginTop: 12,
      backgroundColor: isLight ? 'rgba(255, 255, 255, 0.9)' : cardBgColor,
      position: 'relative',
      borderWidth: 1,
      borderColor: colors2024['neutral-bg-1'],
    },
    wrapperToken: {
      backgroundColor: wrapperTokenCardBgColor,
      borderWidth: 1,
      borderColor: cardBgColor,
    },
    wrapperTokenArrow: {
      position: 'absolute',
      top: -14,
      left: 30,
      zIndex: 1,
      ...makeTriangleStyle({
        dir: 'up',
        size: 7,
        color: cardBgColor,
        backgroundColor: 'transparent',
      }),
    },
    content: {
      paddingHorizontal: 14,
      gap: 10,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    tokenInfo: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: 8,
      flexShrink: 1,
    },
    tokenInfoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
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
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
    },
    apyTag: {
      paddingHorizontal: 4,
      paddingVertical: 1,
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
    badgeContainer: {
      display: 'flex',
      flexDirection: 'row',
      gap: 4,
    },
    amountArea: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 5,
    },
    amountUsd: {
      fontSize: 17,
      lineHeight: 20,
      fontWeight: '500',
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
    },
    amountToken: {
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
    aaveButtonPrimary: {
      flex: 1,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors2024['neutral-line'],
    },
    aaveButtonPrimaryText: {
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
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
      width: 'auto',
      backgroundColor: colors2024['green-light-1'],
    },
    suppliedBadgeText: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '700',
      color: colors2024['green-default'],
      fontFamily: 'SF Pro Rounded',
    },
  };
});

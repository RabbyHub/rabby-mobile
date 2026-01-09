import React, { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';

import TokenIcon from '../TokenIcon';
import { getFromToken } from '../../utils/swap';
import { formatApy, formatListNetWorth } from '../../utils/format';
import { useLendingSummary, useSelectedMarket } from '../../hooks';
import { formatTokenAmount } from '@/utils/number';

interface BorrowItemProps extends RNViewProps {
  underlyingAsset: string;
}

const BorrowItem: React.FC<BorrowItemProps> = ({ underlyingAsset, style }) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });

  const { t } = useTranslation();
  const { selectedMarketData, chainInfo } = useSelectedMarket();
  const {
    iUserSummary: userSummary,
    formattedPoolReservesAndIncentives,
    getTargetReserve,
  } = useLendingSummary();

  const reserve = useMemo(() => {
    return getTargetReserve(underlyingAsset);
  }, [getTargetReserve, underlyingAsset]);

  const { isBorrowed, apyText, usdText, tokenAmountText } = useMemo(() => {
    if (!reserve) {
      return {
        isBorrowed: false,
        apyText: '',
        usdText: '',
        tokenAmountText: '',
      };
    }
    const isBorrowedFlag =
      !!reserve.totalBorrowsUSD && reserve.totalBorrowsUSD !== '0';

    const apy = formatApy(Number(reserve.reserve.variableBorrowAPY || '0'));
    const usd = formatListNetWorth(Number(reserve.totalBorrowsUSD || '0'));

    const tokenAmountNum = Number(reserve.variableBorrows || '0');
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
      isBorrowed: isBorrowedFlag,
      apyText: apy,
      usdText: usd,
      tokenAmountText: `${formatTokenAmount(tokenAmount)} ${
        reserve.reserve.symbol
      }`,
    };
  }, [reserve]);

  const hasBorrowBalance = useMemo(() => {
    if (!reserve) {
      return false;
    }
    return reserve?.variableBorrows && reserve.variableBorrows !== '0';
  }, [reserve]);

  const showDebtSwapButton = useMemo(() => {
    return (
      hasBorrowBalance && !!selectedMarketData?.enabledFeatures?.debtSwitch
    );
  }, [hasBorrowBalance, selectedMarketData?.enabledFeatures?.debtSwitch]);

  const disableDebtSwapButton = useMemo(() => {
    const r = formattedPoolReservesAndIncentives.find(item =>
      isSameAddress(item.underlyingAsset, reserve?.underlyingAsset || ''),
    );
    if (!r) {
      return true;
    }
    const disableEModeSwitch =
      !!userSummary?.userEmodeCategoryId &&
      formattedPoolReservesAndIncentives.filter(_r =>
        _r.eModes.find(
          e => e.id === userSummary?.userEmodeCategoryId && e.borrowingEnabled,
        ),
      ).length < 2;
    return (
      r.isPaused || !r.isActive || r.symbol === 'stETH' || disableEModeSwitch
    );
  }, [
    formattedPoolReservesAndIncentives,
    reserve?.underlyingAsset,
    userSummary?.userEmodeCategoryId,
  ]);

  const disableBorrowButton = useMemo(() => {
    if (!reserve) {
      return false;
    }
    // emode开启，但是不支持该池子借贷
    const eModeBorrowDisabled =
      !!userSummary?.userEmodeCategoryId &&
      !reserve.reserve.eModes.find(
        e => e.id === userSummary.userEmodeCategoryId,
      );
    if (eModeBorrowDisabled) {
      return true;
    }
    if (BigNumber(reserve.reserve.totalDebt).gte(reserve.reserve.borrowCap)) {
      return true;
    }
    return (
      !userSummary?.availableBorrowsUSD ||
      userSummary?.availableBorrowsUSD === '0'
    );
  }, [
    reserve,
    userSummary?.availableBorrowsUSD,
    userSummary?.userEmodeCategoryId,
  ]);

  const handlePressBorrow = () => {
    if (!reserve || !userSummary) {
      return;
    }
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.BORROW_ACTION_DETAIL,
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
  };
  const handlePressRepay = () => {
    if (!reserve || !userSummary) {
      return;
    }
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.REPAY_ACTION_DETAIL,
      reserve,
      userSummary,
      onClose: () => {
        removeGlobalBottomSheetModal2024(modalId);
      },
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        rootViewType: 'View',
        handleStyle: {
          backgroundColor: colors2024['neutral-bg-1'],
        },
      },
    });
  };
  const handleSwapDebt = () => {
    const r = formattedPoolReservesAndIncentives.find(item =>
      isSameAddress(item.underlyingAsset, reserve?.underlyingAsset || ''),
    );
    if (!r || !userSummary || !chainInfo?.id) {
      return;
    }
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.DEBT_SWAP,
      allowAndroidHarewareBack: true,
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        rootViewType: 'View',
        handleStyle: {
          backgroundColor: isLight
            ? colors2024['neutral-bg-0']
            : colors2024['neutral-bg-1'],
        },
      },
      fromToken: getFromToken(
        r,
        chainInfo?.id,
        reserve?.variableBorrows || '0',
      ),
      onClose: () => {
        removeGlobalBottomSheetModal2024(modalId);
      },
    });
  };

  if (!reserve) {
    return null;
  }
  return (
    <View style={[styles.container, style]}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.tokenInfo}>
            <TokenIcon
              size={46}
              chainSize={0}
              tokenSymbol={reserve.reserve.symbol}
              chain={reserve.chain}
            />
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
          </View>
          <View style={styles.amountArea}>
            <Text style={styles.amountUsd}>{usdText}</Text>
            <Text style={styles.amountToken} numberOfLines={1}>
              {tokenAmountText}
            </Text>
          </View>
        </View>

        <View style={styles.buttonRow}>
          {showDebtSwapButton && (
            <TouchableOpacity
              style={styles.buttonSecondary}
              activeOpacity={0.8}
              disabled={disableDebtSwapButton}
              onPress={handleSwapDebt}>
              <Text style={styles.buttonSecondaryText}>
                {t('page.Lending.borrowDetail.swapDebt')}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.buttonSecondary}
            activeOpacity={0.8}
            disabled={disableBorrowButton}
            onPress={handlePressBorrow}>
            <Text style={styles.buttonSecondaryText}>
              {t('page.Lending.borrowDetail.actions')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.buttonPrimary}
            activeOpacity={0.8}
            onPress={handlePressRepay}>
            <Text style={styles.buttonPrimaryText}>
              {t('page.Lending.repayDetail.actions')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {isBorrowed ? (
        <View style={styles.borrowedBadge}>
          <Text style={styles.borrowedBadgeText}>Borrowed</Text>
        </View>
      ) : null}
    </View>
  );
};

export default BorrowItem;

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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
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
    backgroundColor: colors2024['red-light-1'],
  },
  apyTagText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['red-default'],
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
  buttonRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  borrowedBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors2024['red-default'],
  },
  borrowedBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors2024['neutral-InvertHighlight'],
    fontFamily: 'SF Pro Rounded',
  },
}));

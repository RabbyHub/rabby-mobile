import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useEffect, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Button } from '@/components2024/Button';
import AutoLockView from '@/components/AutoLockView';
import { OpenDetailProps } from '../type';
import {
  formatAmountValueKMB,
  formatUsdValueKMB,
} from '@/screens/TokenDetail/util';
import WarningFillCC from '@/assets2024/icons/common/WarningFill-cc.svg';
import { getHealthStatusColor } from '../utils';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import TokenIcon from './TokenIcon';
import BigNumber from 'bignumber.js';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { useTranslation } from 'react-i18next';
import { getHealthFactorText } from './HealthFactorText';
import { formatNetworth } from '@/utils/math';
import { formatApy } from '../utils/format';
import {
  useSelectedMarket,
  useLendingSummary,
  useLendingIsLoading,
} from '../hooks';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { isValidAddress } from '@ethereumjs/util';
import { nativeToWrapper } from '../config/nativeToWrapper';
import DetailLoadingSkeleton from './DetailLoadingSkeleton';
import DebtSwapEntryTips from './DetSwapEntryTips';
import { getFromToken } from '../utils/swap';

export const BorrowDetailPopup: React.FC<OpenDetailProps> = ({
  underlyingAsset,
  onClose,
}) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });
  const { chainEnum, selectedMarketData, chainInfo } = useSelectedMarket();
  const { t } = useTranslation();
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'Lending',
  });
  const { loading } = useLendingIsLoading();
  const {
    displayPoolReserves,
    iUserSummary: userSummary,
    formattedPoolReservesAndIncentives,
    wrapperPoolReserve,
  } = useLendingSummary();
  const reserve = useMemo(() => {
    const validAddress = isValidAddress(underlyingAsset);
    const nativeWrapperReserveAddress = wrapperPoolReserve?.underlyingAsset;
    const defaultAddress = nativeToWrapper[underlyingAsset];
    const realTimeReserve = displayPoolReserves?.find(item =>
      isSameAddress(
        item.underlyingAsset,
        validAddress
          ? underlyingAsset
          : nativeWrapperReserveAddress || defaultAddress,
      ),
    );
    return realTimeReserve;
  }, [
    displayPoolReserves,
    underlyingAsset,
    wrapperPoolReserve?.underlyingAsset,
  ]);

  const handleShowLqBonusPopup = () => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.DESCRIPTION,
      title: t('page.Lending.borrowOverview.liquidityPenalty'),
      titleStyle: {
        marginTop: 12,
        fontWeight: '900',
      },
      sectionStyle: {
        marginTop: 8,
      },
      sectionDescStyle: {
        lineHeight: 20,
      },
      sections: [
        {
          description: t('page.Lending.modalDesc.lqDesc'),
        },
      ],
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        enableDismissOnClose: true,
        snapPoints: [308],
      },
      nextButtonProps: {
        title: t('page.Lending.gotIt'),
        onPress: () => {
          removeGlobalBottomSheetModal2024(modalId);
        },
        containerStyle: {
          position: 'absolute',
          bottom: 48,
          width: '100%',
        },
      },
    });
  };
  const handleShowAvailableToBorrowPopup = () => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.DESCRIPTION,
      title: t('page.Lending.borrowOverview.availableToBorrow'),
      titleStyle: {
        marginTop: 12,
        fontWeight: '900',
      },
      sectionStyle: {
        marginTop: 8,
      },
      sectionDescStyle: {
        lineHeight: 20,
      },
      sections: [
        {
          description: t('page.Lending.modalDesc.availableToBorrowDesc'),
        },
      ],
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        enableDismissOnClose: true,
        snapPoints: [308],
      },
      nextButtonProps: {
        title: t('page.Lending.gotIt'),
        onPress: () => {
          removeGlobalBottomSheetModal2024(modalId);
        },
        containerStyle: {
          position: 'absolute',
          bottom: 48,
          width: '100%',
        },
      },
    });
  };

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
    onClose?.();
    if (!reserve || !userSummary) return;
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
    onClose?.();
    if (!reserve || !userSummary) return;
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.REPAY_ACTION_DETAIL,
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
  const handleSwapDebt = () => {
    const r = formattedPoolReservesAndIncentives.find(item =>
      isSameAddress(item.underlyingAsset, reserve?.underlyingAsset || ''),
    );
    if (!r || !userSummary || !chainInfo?.id) {
      return;
    }
    onClose?.();
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

  useEffect(() => {
    if (!loading && !reserve) {
      onClose?.();
    }
  }, [loading, onClose, reserve]);

  if (loading || !reserve || !userSummary) {
    return <DetailLoadingSkeleton />;
  }
  return (
    <AutoLockView as="BottomSheetView" style={styles.container}>
      <Text style={styles.title}>{t('page.Lending.borrowOverview.title')}</Text>
      <View style={styles.contentContainer}>
        <View style={[styles.poolInfoContainer, styles.card]}>
          <View style={styles.tokenInfos}>
            <TokenIcon
              size={30}
              chain={chainEnum}
              chainSize={14}
              tokenSymbol={reserve.reserve.symbol}
            />
            <Text style={styles.symbol}>{reserve.reserve.symbol}</Text>
          </View>
          <View style={styles.poolInfoItems}>
            <View style={styles.poolInfoItem}>
              <Text style={styles.poolInfoItemTitle}>
                {t('page.Lending.borrowOverview.totalBorrowed')}
              </Text>
              <Text style={styles.poolInfoItemValue}>
                {formatUsdValueKMB(reserve.reserve.totalVariableDebtUSD)}
              </Text>
            </View>
            <View style={styles.poolInfoItem}>
              <Text style={styles.poolInfoItemTitle}>
                {t('page.Lending.apy')}
              </Text>
              <Text style={styles.poolInfoItemValue}>
                {formatApy(Number(reserve.reserve.variableBorrowAPY || '0'))}
              </Text>
            </View>
            <View style={styles.poolInfoItem}>
              <Text style={styles.poolInfoItemTitle}>
                {t('page.Lending.borrowOverview.borrowCap')}
              </Text>
              <Text style={styles.poolInfoItemValue}>
                {formatUsdValueKMB(reserve.reserve.borrowCapUSD || '0')}
              </Text>
            </View>
          </View>
        </View>
        <View style={[styles.userInfoContainer, styles.card, styles.infoCard]}>
          <View style={styles.userInfoItem}>
            <View style={styles.myBorrowItem}>
              <WalletIcon
                type={currentAccount?.type}
                address={currentAccount?.address}
                width={30}
                height={30}
                borderRadius={8}
              />
              <Text style={styles.supplyItemTitle}>
                {t('page.Lending.borrowOverview.myBorrow')}
              </Text>
            </View>
            <Text
              style={[
                styles.supplyItemValue,
                reserve.variableBorrows === '0' && {
                  color: colors2024['neutral-title-1'],
                },
              ]}>
              {formatNetworth(Number(reserve.variableBorrowsUSD || '0'))}
            </Text>
          </View>
          {hasBorrowBalance && (
            <>
              <View style={styles.userInfoItem}>
                <Text style={styles.userInfoItemTitle}>
                  {t('page.Lending.hf')}
                </Text>
                <Text
                  style={[
                    styles.userInfoItemValue,
                    {
                      color: getHealthStatusColor(
                        Number(userSummary?.healthFactor || '0'),
                      ).color,
                    },
                  ]}>
                  {getHealthFactorText(userSummary?.healthFactor)}
                </Text>
              </View>
              <View style={styles.userInfoItem}>
                <Text style={styles.userInfoItemTitle}>
                  {t('page.Lending.supplyOverview.walletBalance')}
                </Text>
                <Text style={styles.userInfoItemValue}>
                  ${formatAmountValueKMB(reserve.walletBalanceUSD || '0')}{' '}
                </Text>
              </View>
              <View style={styles.userInfoItem}>
                <View style={styles.leftTitleContainer}>
                  <Text style={styles.userInfoItemTitle}>
                    {t('page.Lending.borrowOverview.liquidityPenalty')}
                  </Text>
                  <Pressable hitSlop={20} onPress={handleShowLqBonusPopup}>
                    <WarningFillCC
                      width={12}
                      height={12}
                      color={colors2024['neutral-info']}
                    />
                  </Pressable>
                </View>
                <Text style={styles.userInfoItemValue}>
                  {formatApy(
                    Number(
                      reserve.reserve.formattedReserveLiquidationBonus || '0',
                    ),
                  )}
                </Text>
              </View>
            </>
          )}
          <View style={styles.userInfoItem}>
            <View style={styles.leftTitleContainer}>
              <Text style={styles.userInfoItemTitle}>
                {t('page.Lending.borrowOverview.availableToBorrow')}
              </Text>
              <Pressable
                hitSlop={20}
                onPress={handleShowAvailableToBorrowPopup}>
                <WarningFillCC
                  width={12}
                  height={12}
                  color={colors2024['neutral-info']}
                />
              </Pressable>
            </View>

            <Text style={styles.userInfoItemValue}>
              {formatUsdValueKMB(userSummary?.availableBorrowsUSD || '0')}
            </Text>
          </View>
          {showDebtSwapButton && (
            <View style={[styles.userInfoItem, styles.innerBtnsContainer]}>
              {hasBorrowBalance && (
                <Button
                  type="ghost"
                  buttonStyle={[styles.repayButton, styles.innerRepayButton]}
                  titleStyle={styles.repayButtonTitle}
                  containerStyle={styles.button}
                  onPress={handlePressRepay}
                  title={t('page.Lending.repayDetail.actions')}
                />
              )}
              <Button
                containerStyle={styles.button}
                disabled={disableBorrowButton}
                titleStyle={[
                  styles.borrowButtonTitle,
                  styles.innerBorrowButtonTitle,
                ]}
                buttonStyle={[styles.innerBorrowButton]}
                onPress={handlePressBorrow}
                title={t('page.Lending.borrowDetail.actions')}
              />
            </View>
          )}
        </View>
      </View>
      <View style={styles.buttonContainer}>
        {showDebtSwapButton ? (
          <DebtSwapEntryTips>
            <Button
              containerStyle={styles.button}
              titleStyle={styles.borrowButtonTitle}
              disabled={disableDebtSwapButton}
              onPress={handleSwapDebt}
              title={t('page.Lending.borrowDetail.swapDebt')}
            />
          </DebtSwapEntryTips>
        ) : (
          <>
            {hasBorrowBalance && (
              <Button
                type="ghost"
                buttonStyle={styles.repayButton}
                titleStyle={styles.repayButtonTitle}
                containerStyle={styles.button}
                onPress={handlePressRepay}
                title={t('page.Lending.repayDetail.actions')}
              />
            )}
            <Button
              containerStyle={styles.button}
              disabled={disableBorrowButton}
              titleStyle={styles.borrowButtonTitle}
              onPress={handlePressBorrow}
              title={t('page.Lending.borrowDetail.actions')}
            />
          </>
        )}
      </View>
    </AutoLockView>
  );
};
const getStyles = createGetStyles2024(ctx => ({
  container: {
    // paddingHorizontal: 25,
    height: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'column',
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
  },
  card: {
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-1']
      : ctx.colors2024['neutral-bg-2'],
    padding: 12,
    borderRadius: 16,
    width: '100%',
  },
  infoCard: {
    paddingBottom: 21,
  },
  contentContainer: {
    paddingHorizontal: 16,
    width: '100%',
  },
  poolInfoContainer: {
    marginTop: 16,
  },
  userInfoContainer: {
    marginTop: 12,
    gap: 24,
  },
  symbol: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  tokenInfos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  poolInfoItems: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
  },
  poolInfoItem: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-2']
      : ctx.colors2024['neutral-bg-5'],
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  poolInfoItemTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  poolInfoItemValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  title: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
    textAlign: 'center',
    marginTop: 12,
    fontFamily: 'SF Pro Rounded',
  },
  supplyItemTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  supplyItemValue: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    color: ctx.colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
  },
  userInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  innerBtnsContainer: {
    gap: 12,
  },
  myBorrowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userInfoItemTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: ctx.colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  userInfoItemValue: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  sectionContainer: {
    paddingBottom: 32,
    width: '100%',
  },
  section: {
    marginTop: 28,
    lineHeight: 24,
  },
  sectionTitle: {
    marginBottom: 5,
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 24,
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  sectionDesc: {
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 24,
    color: ctx.colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  buttonContainer: {
    height: 116,
    paddingTop: 12,
    marginTop: 'auto',
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-1']
      : ctx.colors2024['neutral-bg-2'],
  },
  button: {
    flex: 1,
  },
  leftTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  repayButton: {
    borderWidth: 0,
    backgroundColor: ctx.colors2024['neutral-line'],
  },
  innerRepayButton: {
    backgroundColor: ctx.colors2024['neutral-bg-5'],
  },
  repayButtonTitle: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  borrowButtonTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  innerBorrowButtonTitle: {
    color: ctx.colors2024['brand-default'],
  },
  innerBorrowButton: {
    backgroundColor: ctx.colors2024['brand-light-1'],
  },
}));

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useEffect, useMemo } from 'react';
import { View, Text } from 'react-native';
import { Button } from '@/components2024/Button';
import AutoLockView from '@/components/AutoLockView';
import { OpenDetailProps } from '../type';
import { formatUsdValueKMB } from '@/screens/Home/utils/price';
import { formatAmountValueKMB } from '@/screens/TokenDetail/util';
import TokenIcon from './TokenIcon';
import BigNumber from 'bignumber.js';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import {
  RESERVE_USAGE_WARNING_THRESHOLD,
  SUPPLY_UI_SAFE_MARGIN,
} from '../utils/constant';
import WarningFillCC from '@/assets2024/icons/lending/warning-cc.svg';
import { Tip } from '@/components/Tip';
import { useTranslation } from 'react-i18next';
import { formatNetworth } from '@/utils/math';
import IsolatedTag from './IsolatedTag';
import { formatApy } from '../utils/format';
import {
  useLendingIsLoading,
  useLendingSummary,
  useSelectedMarket,
} from '../hooks';
import { CollateralSwitch } from './CollateralSwitch';
import { getSupplyCapData } from '../utils/supply';
import { useToggleCollateralModal } from '../modals/ToggleCollateralModal';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { isValidAddress } from '@ethereumjs/util';
import { nativeToWrapper } from '../config/nativeToWrapper';
import DetailLoadingSkeleton from './DetailLoadingSkeleton';

export const SupplyDetailPopup: React.FC<OpenDetailProps> = ({
  underlyingAsset,
  onClose,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { chainEnum } = useSelectedMarket();
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'Lending',
  });
  const { loading } = useLendingIsLoading();
  const {
    displayPoolReserves,
    iUserSummary: userSummary,
    wrapperPoolReserve,
  } = useLendingSummary();
  const { t } = useTranslation();

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

  const hasSupplyBalance = useMemo(() => {
    return reserve?.underlyingBalance && reserve?.underlyingBalance !== '0';
  }, [reserve?.underlyingBalance]);

  const disableSupplyButton = useMemo(() => {
    if (!reserve) {
      return false;
    }
    if (
      BigNumber(reserve?.reserve?.totalLiquidity || '0').gte(
        reserve?.reserve?.supplyCap || '0',
      )
    ) {
      return true;
    }
    return !reserve?.walletBalance || reserve.walletBalance === '0';
  }, [reserve]);

  const errorMessage = useMemo(() => {
    if (!reserve) {
      return undefined;
    }
    if (
      reserve.reserve.totalLiquidity &&
      reserve.reserve.totalLiquidity !== '0' &&
      reserve.reserve.supplyCap &&
      reserve.reserve.supplyCap !== '0' &&
      BigNumber(reserve.reserve.totalLiquidity).gte(reserve.reserve.supplyCap)
    ) {
      return t('page.Lending.supplyOverview.reachCap');
    }
    // 占比大于98% 显示警告
    if (
      reserve.reserve.totalLiquidity &&
      reserve.reserve.totalLiquidity !== '0' &&
      reserve.reserve.supplyCap &&
      reserve.reserve.supplyCap !== '0' &&
      BigNumber(reserve.reserve.totalLiquidity).gte(
        BigNumber(reserve.reserve.supplyCap).multipliedBy(
          RESERVE_USAGE_WARNING_THRESHOLD,
        ),
      )
    ) {
      const available = BigNumber(reserve.reserve.supplyCapUSD)
        .minus(BigNumber(reserve.reserve.totalLiquidityUSD))
        .toString();
      return t('page.Lending.supplyOverview.almostCap', {
        available: formatUsdValueKMB(available),
      });
    }
    return undefined;
  }, [reserve, t]);

  const supplyAvailable = useMemo(() => {
    if (!reserve) {
      return '0';
    }
    const myAmount = BigNumber(reserve?.walletBalance || '0');
    const poolAmount = BigNumber(reserve?.reserve?.supplyCap || '0')
      .minus(BigNumber(reserve.reserve.totalLiquidity))
      .multipliedBy(SUPPLY_UI_SAFE_MARGIN);
    const miniAmount = myAmount.gte(poolAmount) ? poolAmount : myAmount;
    const usdValue = miniAmount
      .multipliedBy(
        BigNumber(
          reserve.reserve.formattedPriceInMarketReferenceCurrency || '0',
        ),
      )
      .toString();
    return usdValue;
  }, [reserve]);

  const handlePressSupply = () => {
    onClose?.();
    if (!reserve || !userSummary) return;
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
  };
  const handlePressWithdraw = () => {
    onClose?.();
    if (!reserve || !userSummary) return;
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
  };
  const { openCollateralChange } = useToggleCollateralModal();

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
      <Text style={styles.title}>{t('page.Lending.supplyOverview.title')}</Text>
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
            {!Number(reserve.underlyingBalance || '0') &&
              reserve?.reserve?.isIsolated && <IsolatedTag />}
          </View>
          <View style={styles.poolInfoItems}>
            <View style={styles.poolInfoItem}>
              <Text style={styles.poolInfoItemTitle}>
                {t('page.Lending.supplyOverview.totalSupplied')}
              </Text>
              <Text style={styles.poolInfoItemValue}>
                {formatUsdValueKMB(reserve.reserve.totalLiquidityUSD, 0)} of{' '}
                {formatUsdValueKMB(reserve.reserve.supplyCapUSD || '0', 0)}
              </Text>
            </View>
            <View style={styles.poolInfoItem}>
              <Text style={styles.poolInfoItemTitle}>
                {t('page.Lending.apy')}
              </Text>
              <Text style={styles.poolInfoItemValue}>
                {formatApy(Number(reserve.reserve.supplyAPY || '0'))}
              </Text>
            </View>
          </View>
        </View>
        <View style={[styles.userInfoContainer, styles.card, styles.infoCard]}>
          <View style={styles.userInfoItem}>
            <View style={styles.availableToSupplyItem}>
              <WalletIcon
                type={currentAccount?.type}
                address={currentAccount?.address}
                width={30}
                height={30}
                borderRadius={8}
              />
              <Text style={styles.supplyItemTitle}>
                {t('page.Lending.supplyOverview.mySupply')}
              </Text>
            </View>
            <Text
              style={[
                styles.supplyItemValue,
                reserve.underlyingBalance === '0' && {
                  color: colors2024['neutral-title-1'],
                },
              ]}>
              {formatNetworth(Number(reserve.underlyingBalanceUSD || '0'))}
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
            <Text style={styles.userInfoItemTitle}>
              {t('page.Lending.supplyOverview.availableToSupply')}
            </Text>
            <View style={styles.userInfoItemValueContainer}>
              <Text style={styles.userInfoItemValue}>
                ${formatAmountValueKMB(supplyAvailable || '0')}
              </Text>
              {errorMessage ? (
                <Tip content={errorMessage}>
                  <WarningFillCC
                    width={14}
                    height={14}
                    color={colors2024['red-default']}
                  />
                </Tip>
              ) : null}
            </View>
          </View>
          {Number(reserve.underlyingBalance || '0') > 0 && (
            <View style={styles.userInfoItem}>
              <View style={styles.collateralContainer}>
                <Text style={styles.userInfoItemTitle}>
                  {t('page.Lending.supplyOverview.useAsCollateral')}
                </Text>
                {reserve?.reserve?.isIsolated && <IsolatedTag />}
              </View>
              <View style={styles.userInfoItemValueContainer}>
                <CollateralSwitch
                  reserve={reserve}
                  canBeEnabledAsCollateral={canBeEnabledAsCollateral}
                  onValueChange={() => {
                    onClose?.();
                    openCollateralChange(reserve);
                  }}
                />
              </View>
            </View>
          )}
        </View>
      </View>
      <View style={styles.buttonContainer}>
        {hasSupplyBalance && (
          <Button
            type="ghost"
            buttonStyle={styles.withdrawButton}
            titleStyle={styles.withdrawButtonTitle}
            containerStyle={styles.button}
            title={t('page.Lending.withdrawDetail.actions')}
            onPress={handlePressWithdraw}
          />
        )}
        <Button
          onPress={handlePressSupply}
          disabled={disableSupplyButton}
          containerStyle={styles.button}
          titleStyle={styles.supplyButtonTitle}
          title={t('page.Lending.supplyDetail.actions')}
        />
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
    paddingBottom: 24,
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
    color: ctx.colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
  },
  userInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  availableToSupplyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collateralContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  userInfoItemValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  withdrawButton: {
    borderWidth: 0,
    backgroundColor: ctx.colors2024['neutral-line'],
  },
  withdrawButtonTitle: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  supplyButtonTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
}));

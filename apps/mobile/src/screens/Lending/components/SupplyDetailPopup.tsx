import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { Button } from '@/components2024/Button';
import AutoLockView from '@/components/AutoLockView';
import { PopupDetailProps } from '../type';
import { formatUsdValueKMB } from '@/screens/Home/utils/price';
import {
  formatAmountValueKMB,
  formatPercent,
} from '@/screens/TokenDetail/util';
import TokenIcon from './TokenIcon';
import { useLendingService } from '../hooks/useLendingService';
import BigNumber from 'bignumber.js';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { RESERVE_USAGE_WARNING_THRESHOLD } from '../utils/constant';
import WarningFillCC from '@/assets2024/icons/lending/warning-cc.svg';
import { Tip } from '@/components/Tip';
import { formatTokenAmount } from '@debank/common';

export const SupplyDetailPopup: React.FC<PopupDetailProps> = ({
  reserve,
  userSummary,
  onClose,
}) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });
  const { lastSelectedChain } = useLendingService();
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const hasSupplyBalance = useMemo(() => {
    return reserve?.underlyingBalance && reserve.underlyingBalance !== '0';
  }, [reserve.underlyingBalance]);

  const disableSupplyButton = useMemo(() => {
    if (
      BigNumber(reserve.reserve.totalLiquidity).gte(reserve.reserve.supplyCap)
    ) {
      return true;
    }
    return !reserve?.walletBalance || reserve.walletBalance === '0';
  }, [
    reserve.reserve.supplyCap,
    reserve.reserve.totalLiquidity,
    reserve.walletBalance,
  ]);

  const errorMessage = useMemo(() => {
    if (
      reserve.reserve.totalLiquidity &&
      reserve.reserve.totalLiquidity !== '0' &&
      reserve.reserve.supplyCap &&
      reserve.reserve.supplyCap !== '0' &&
      BigNumber(reserve.reserve.totalLiquidity).gte(reserve.reserve.supplyCap)
    ) {
      return 'This asset has reached its supply cap. Nothing is available to be supplied from this market.';
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
      return `This asset has almost reached its borrow cap. There is only ${formatUsdValueKMB(
        available,
      )} available to be borrowed from this market.`;
    }
    return undefined;
  }, [
    reserve.reserve.supplyCap,
    reserve.reserve.supplyCapUSD,
    reserve.reserve.totalLiquidity,
    reserve.reserve.totalLiquidityUSD,
  ]);

  const handlePressSupply = () => {
    onClose?.();
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.SUPPLY_ACTION_DETAIL,
      reserve: reserve,
      userSummary,
      onClose: () => {
        removeGlobalBottomSheetModal2024(modalId);
      },
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        enableDismissOnClose: true,
        handleStyle: {
          backgroundColor: isLight
            ? colors2024['neutral-bg-1']
            : colors2024['neutral-bg-1'],
        },
      },
    });
  };
  const handlePressWithdraw = () => {
    onClose?.();
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.WITHDRAW_ACTION_DETAIL,
      reserve: reserve,
      userSummary,
      onClose: () => {
        removeGlobalBottomSheetModal2024(modalId);
      },
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        enableDismissOnClose: true,
        handleStyle: {
          backgroundColor: isLight
            ? colors2024['neutral-bg-1']
            : colors2024['neutral-bg-1'],
        },
      },
    });
  };

  return (
    <AutoLockView as="BottomSheetView" style={styles.container}>
      <Text style={styles.title}>Supply Details</Text>
      <View style={styles.contentContainer}>
        <View style={[styles.poolInfoContainer, styles.card]}>
          <View style={styles.tokenInfos}>
            <TokenIcon
              size={30}
              chain={lastSelectedChain}
              chainSize={14}
              tokenSymbol={reserve.reserve.symbol}
            />
            <Text style={styles.symbol}>{reserve.reserve.symbol}</Text>
          </View>
          <View style={styles.poolInfoItems}>
            <View style={styles.poolInfoItem}>
              <Text style={styles.poolInfoItemTitle}>Total Supplied</Text>
              <Text style={styles.poolInfoItemValue}>
                {formatUsdValueKMB(reserve.reserve.totalLiquidityUSD, 0)} of{' '}
                {formatUsdValueKMB(reserve.reserve.supplyCapUSD || '0', 0)}
              </Text>
            </View>
            <View style={styles.poolInfoItem}>
              <Text style={styles.poolInfoItemTitle}>APY</Text>
              <Text style={styles.poolInfoItemValue}>
                {formatPercent(Number(reserve.reserve.supplyAPY || '0'))}
              </Text>
            </View>
          </View>
        </View>
        <View style={[styles.userInfoContainer, styles.card]}>
          <View style={styles.userInfoItem}>
            <View style={styles.userInfoItem}>
              <WalletIcon
                type={currentAccount?.type}
                address={currentAccount?.address}
                width={30}
                height={30}
                borderRadius={8}
              />
              <Text style={styles.supplyItemTitle}>My Supply</Text>
            </View>
            <Text
              style={[
                styles.supplyItemValue,
                reserve.underlyingBalance === '0' && {
                  color: colors2024['neutral-title-1'],
                },
              ]}>
              {formatUsdValueKMB(reserve.underlyingBalanceUSD || '0')}
            </Text>
          </View>
          <View style={styles.userInfoItem}>
            <Text style={styles.userInfoItemTitle}>Wallet Balance</Text>
            <Text style={styles.userInfoItemValue}>
              {formatTokenAmount(reserve.walletBalance || '0')}{' '}
              {reserve.reserve.symbol}
            </Text>
          </View>
          <View style={styles.userInfoItem}>
            <Text style={styles.userInfoItemTitle}>Available to Supply</Text>
            <View style={styles.userInfoItemValueContainer}>
              <Text style={styles.userInfoItemValue}>
                ${formatAmountValueKMB(reserve.walletBalanceUSD || '0')}
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
        </View>
      </View>
      <View style={styles.buttonContainer}>
        {hasSupplyBalance && (
          <Button
            type="ghost"
            buttonStyle={styles.withdrawButton}
            titleStyle={styles.withdrawButtonTitle}
            containerStyle={styles.button}
            title={'Withdraw'}
            onPress={handlePressWithdraw}
          />
        )}
        <Button
          onPress={handlePressSupply}
          disabled={disableSupplyButton}
          containerStyle={styles.button}
          titleStyle={styles.supplyButtonTitle}
          title={'Supply'}
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
    fontWeight: '700',
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  tokenInfos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    fontWeight: '500',
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  poolInfoItemValue: {
    fontSize: 14,
    fontWeight: '700',
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  title: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
    textAlign: 'center',
    marginTop: 0,
    fontFamily: 'SF Pro Rounded',
  },
  supplyItemTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  supplyItemValue: {
    fontSize: 20,
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
  userInfoItemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: ctx.colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  userInfoItemValue: {
    fontSize: 16,
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
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  supplyButtonTitle: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
}));

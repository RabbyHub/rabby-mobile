import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Button } from '@/components2024/Button';
import AutoLockView from '@/components/AutoLockView';
import { PopupDetailProps } from '../type';
import { formatPercent, formatUsdValueKMB } from '@/screens/TokenDetail/util';
import { formatNum } from '@/utils/math';
import WarningFillCC from '@/assets2024/icons/common/WarningFill-cc.svg';
import { getHealthStatusColor } from '../utils';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import TokenIcon from './TokenIcon';
import { useLendingService } from '../hooks/useLendingService';
import BigNumber from 'bignumber.js';

export const BorrowDetailPopup: React.FC<PopupDetailProps> = ({
  reserve,
  userSummary,
}) => {
  const { styles, isLight, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { lastSelectedChain } = useLendingService();

  const handleShowLqBonusPopup = () => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.DESCRIPTION,
      title: 'Liquidity Penalty',
      titleStyle: {
        marginTop: 12,
      },
      sectionStyle: {
        marginTop: 8,
      },
      sectionDescStyle: {
        lineHeight: 20,
      },
      sections: [
        {
          description:
            'When a liquidation occurs, liquidators repay up to 50% of the outstanding borrowed amount on behalf of the borrower. In return, they can buy the collateral at a discount and keep the difference (liquidation penalty) as a bonus.',
        },
      ],
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        enableDismissOnClose: true,
        snapPoints: [308],
      },
      nextButtonProps: {
        title: 'Got it',
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
      title: 'Available to borrow',
      titleStyle: {
        marginTop: 12,
      },
      sectionStyle: {
        marginTop: 8,
      },
      sectionDescStyle: {
        lineHeight: 20,
      },
      sections: [
        {
          description:
            'You can borrow based on your supplied collateral and until the borrow cap is reached.',
        },
      ],
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        enableDismissOnClose: true,
        snapPoints: [308],
      },
      nextButtonProps: {
        title: 'Got it',
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
    return reserve?.variableBorrows && reserve.variableBorrows !== '0';
  }, [reserve.variableBorrows]);

  const disableBorrowButton = useMemo(() => {
    if (BigNumber(reserve.reserve.totalDebt).gte(reserve.reserve.borrowCap)) {
      return true;
    }
    return (
      !userSummary?.availableBorrowsUSD ||
      userSummary?.availableBorrowsUSD === '0' ||
      userSummary?.availableBorrowsUSD === '$0'
    );
  }, [
    reserve.reserve.borrowCap,
    reserve.reserve.totalDebt,
    userSummary?.availableBorrowsUSD,
  ]);

  const handlePressBorrow = () => {
    createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.BORROW_ACTION_DETAIL,
      reserve,
      userSummary,
    });
  };
  const handlePressRepay = () => {
    createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.REPAY_ACTION_DETAIL,
      reserve,
      userSummary,
    });
  };
  return (
    <AutoLockView as="BottomSheetView" style={styles.container}>
      <Text style={styles.title}>Borrow Details</Text>
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
              <Text style={styles.poolInfoItemTitle}>Total Borrowed</Text>
              <Text style={styles.poolInfoItemValue}>
                {formatUsdValueKMB(reserve.reserve.totalVariableDebtUSD)}
              </Text>
            </View>
            <View style={styles.poolInfoItem}>
              <Text style={styles.poolInfoItemTitle}>APY</Text>
              <Text style={styles.poolInfoItemValue}>
                {formatPercent(
                  Number(reserve.reserve.variableBorrowAPY || '0'),
                )}
              </Text>
            </View>
            <View style={styles.poolInfoItem}>
              <Text style={styles.poolInfoItemTitle}>Borrow Cap</Text>
              <Text style={styles.poolInfoItemValue}>
                {formatUsdValueKMB(reserve.reserve.borrowCapUSD || '0')}
              </Text>
            </View>
          </View>
        </View>
        <View style={[styles.userInfoContainer, styles.card]}>
          <View style={styles.userInfoItem}>
            <View style={styles.userInfoItem}>
              <Text style={styles.supplyItemTitle}>My Borrow</Text>
            </View>
            <Text
              style={[
                styles.supplyItemValue,
                reserve.variableBorrows === '0' && {
                  color: colors2024['neutral-title-1'],
                },
              ]}>
              {formatUsdValueKMB(reserve.variableBorrowsUSD || '0')}
            </Text>
          </View>
          {reserve.underlyingBalance !== '0' && (
            <>
              <View style={styles.userInfoItem}>
                <Text style={styles.userInfoItemTitle}>Health Factor</Text>
                <Text
                  style={[
                    styles.userInfoItemValue,
                    {
                      color: getHealthStatusColor(
                        isLight,
                        Number(userSummary?.healthFactor || '0'),
                      ).color,
                    },
                  ]}>
                  {formatNum(userSummary?.healthFactor)}
                </Text>
              </View>
              <View style={styles.userInfoItem}>
                <View style={styles.leftTitleContainer}>
                  <Text style={styles.userInfoItemTitle}>
                    Liquidity Penalty
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
                  {formatPercent(
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
              <Text style={styles.userInfoItemTitle}>Available to Borrow</Text>
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
        </View>
      </View>
      <View style={styles.buttonContainer}>
        {hasBorrowBalance && (
          <Button
            type="ghost"
            buttonStyle={styles.repayButton}
            titleStyle={styles.repayButtonTitle}
            containerStyle={styles.button}
            onPress={handlePressRepay}
            title={'Repay'}
          />
        )}
        <Button
          containerStyle={styles.button}
          disabled={disableBorrowButton}
          titleStyle={styles.borrowButtonTitle}
          onPress={handlePressBorrow}
          title={'Borrow'}
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
    backgroundColor: ctx.colors2024['neutral-bg-0'],
  },
  card: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
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
    backgroundColor: ctx.colors2024['neutral-bg-2'],
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
    color: ctx.colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
  },
  userInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    backgroundColor: ctx.colors2024['neutral-bg-1'],
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
  repayButtonTitle: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  borrowButtonTitle: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
}));

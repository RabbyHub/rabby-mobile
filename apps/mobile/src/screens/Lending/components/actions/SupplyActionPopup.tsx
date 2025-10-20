import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableWithoutFeedback, Keyboard } from 'react-native';
import AutoLockView from '@/components/AutoLockView';
import { PopupDetailProps } from '../../type';
import { formatAmountValueKMB } from '@/screens/TokenDetail/util';
import { TokenAmountInput } from './TokenAmountInput';
import { CHAINS_ENUM } from '@debank/common';
import SupplyActionOverView from './SupplyActionOverView';
import { calculateHFAfterSupply } from '../../utils/hfUtils';
import { useLendingSummary } from '../../hooks';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import BigNumber from 'bignumber.js';

export const SupplyActionPopup: React.FC<PopupDetailProps> = ({
  reserve,
  userSummary,
}) => {
  const { styles, isLight, colors2024 } = useTheme2024({ getStyle: getStyles });
  const [amount, setAmount] = useState('0');
  const { iUserSummary, formattedPoolReservesAndIncentives } =
    useLendingSummary();

  const afterHF = useMemo(() => {
    if (!amount || amount === '0') {
      return undefined;
    }
    const targetPool = formattedPoolReservesAndIncentives.find(item =>
      isSameAddress(item.underlyingAsset, reserve.underlyingAsset),
    );
    if (!targetPool) {
      return undefined;
    }
    return calculateHFAfterSupply(
      userSummary,
      targetPool,
      BigNumber(amount),
    ).toString();
  }, [
    amount,
    formattedPoolReservesAndIncentives,
    reserve.underlyingAsset,
    userSummary,
  ]);

  const afterAvailable = useMemo(() => {
    return BigNumber(amount)
      .multipliedBy(reserve.reserve.priceInUSD)
      .multipliedBy(reserve.reserve.formattedBaseLTVasCollateral)
      .plus(BigNumber(userSummary.availableBorrowsUSD))
      .toString();
  }, [
    amount,
    reserve.reserve.formattedBaseLTVasCollateral,
    reserve.reserve.priceInUSD,
    userSummary.availableBorrowsUSD,
  ]);

  return (
    <AutoLockView as="BottomSheetView" style={styles.container}>
      <Text style={styles.title}>Supply {reserve.reserve.symbol}</Text>
      <View style={styles.amountHeader}>
        <Text style={styles.amountHeaderTitle}>Amount</Text>
        <Text style={styles.amountValueDescription}>{`${formatAmountValueKMB(
          reserve.walletBalance || '0',
        )}${reserve.reserve.symbol}($${formatAmountValueKMB(
          reserve.walletBalanceUSD || '0',
        )}) available`}</Text>
      </View>
      <TokenAmountInput
        value={amount}
        onChange={setAmount}
        symbol={reserve.reserve.symbol}
        handleClickMaxButton={() => {
          setAmount(reserve.walletBalance || '0');
        }}
        tokenAmount={Number(reserve.walletBalance || '0')}
        price={Number(reserve.reserve.priceInUSD || '0')}
        style={styles.amountInput}
        chain={CHAINS_ENUM.ETH}
      />
      <SupplyActionOverView
        reserve={reserve}
        userSummary={userSummary}
        afterHF={afterHF}
        afterAvailable={afterAvailable}
      />
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
    paddingHorizontal: 20,
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  amountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
    marginTop: 36,
  },
  amountHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  amountValueDescription: {
    fontSize: 14,
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  amountInput: {
    marginTop: 12,
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

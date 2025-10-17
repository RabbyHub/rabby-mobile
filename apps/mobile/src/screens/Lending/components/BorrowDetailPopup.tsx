import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View, Text } from 'react-native';
import { Button } from '@/components2024/Button';
import AutoLockView from '@/components/AutoLockView';
import { DisplayPoolReserveInfo } from '../type';
import { formatPercent, formatUsdValueKMB } from '@/screens/TokenDetail/util';
import { formatNum } from '@/utils/math';
import { getHealthStatusColor } from '../utils';

export interface IBorrowDetailPopupProps {
  reserve: DisplayPoolReserveInfo;
  availableBorrowsUSD: string;
  healthFactor: string;
}
export const BorrowDetailPopup: React.FC<IBorrowDetailPopupProps> = ({
  reserve,
  availableBorrowsUSD,
  healthFactor,
}) => {
  const { styles, isLight } = useTheme2024({ getStyle: getStyles });

  return (
    <AutoLockView as="BottomSheetView" style={styles.container}>
      <Text style={styles.title}>Borrow Details</Text>
      <View style={styles.contentContainer}>
        <View style={[styles.poolInfoContainer, styles.card]}>
          <View style={styles.tokenInfos}>
            <View />
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
            <Text style={styles.supplyItemValue}>
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
                        Number(healthFactor || '0'),
                      ).color,
                    },
                  ]}>
                  {formatNum(healthFactor)}
                </Text>
              </View>
              <View style={styles.userInfoItem}>
                <Text style={styles.userInfoItemTitle}>Liquidity Penalty</Text>
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
            <Text style={styles.userInfoItemTitle}>Available to Borrow</Text>
            <Text style={styles.userInfoItemValue}>
              {formatUsdValueKMB(availableBorrowsUSD || '0')}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.buttonContainer}>
        <Button containerStyle={styles.button} title={'Repay'} />
        <Button containerStyle={styles.button} title={'Borrow'} />
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
    color: ctx.colors2024['neutral-title-1'],
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
}));

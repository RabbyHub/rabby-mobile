import AutoLockView from '@/components/AutoLockView';
import RcIconInfoCC from '@/assets2024/icons/perps/IconInfoCC.svg';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { useTipsPopup } from '@/hooks/useTipsPopup';
import { formatPercent } from '@/screens/Home/utils/price';
import { splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useMemoizedFn } from 'ahooks';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { PerpsSlider } from './PerpsSlider';
import {
  PERPS_EXCHANGE_FEE_NUMBER,
  PERPS_MINI_USD_VALUE,
} from '@/constant/perps';

export const PerpsClosePositionPopup: React.FC<{
  visible?: boolean;
  coin: string;
  direction: 'Long' | 'Short';
  positionSize: string;
  marginUsed: number;
  markPrice: number;
  entryPrice: number;
  providerFee: number;
  pnl: number;
  onCancel: () => void;
  onConfirm: () => void;
  handleClosePosition: (closePercent: number) => Promise<void>;
}> = ({
  visible,
  coin: _coin,
  direction,
  positionSize,
  marginUsed,
  pnl,
  markPrice,
  entryPrice,
  providerFee,
  onCancel,
  onConfirm,
  handleClosePosition,
}) => {
  const modalRef = useRef<AppBottomSheetModal>(null);

  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyle,
  });

  const { t } = useTranslation();
  const { showTipsPopup } = useTipsPopup();

  const [loading, setLoading] = useState<boolean>(false);
  const [closePercent, setClosePercent] = useState<number>(100);

  const closePosition = useMemoizedFn(async () => {
    setLoading(true);
    try {
      await handleClosePosition(closePercent);
      onConfirm();
    } finally {
      setLoading(false);
    }
  });

  const minClosePercent = useMemo(() => {
    const minSizeValue = PERPS_MINI_USD_VALUE / markPrice;
    const percentValue = (minSizeValue / Number(positionSize)) * 100;

    // add one percent to avoid rounding error
    return Math.min(100, Math.round(percentValue + 1));
  }, [markPrice, positionSize]);

  useEffect(() => {
    if (!visible) {
      setLoading(false);
      setClosePercent(100);
    }
  }, [visible]);

  const closedPnl = useMemo(() => {
    return (pnl * closePercent) / 100;
  }, [pnl, closePercent]);

  const bothFee = useMemo(() => {
    return providerFee + PERPS_EXCHANGE_FEE_NUMBER;
  }, [providerFee]);

  const isValidClosePercent = useMemo(() => {
    if (loading) {
      return true;
    }

    return closePercent >= minClosePercent;
  }, [closePercent, minClosePercent, loading]);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg1',
      })}
      onDismiss={onCancel}
      snapPoints={[490]}>
      <BottomSheetView>
        <AutoLockView style={[styles.container]}>
          <View>
            <Text style={styles.title}>
              {t('page.perpsDetail.PerpsClosePositionPopup.title')}
            </Text>
          </View>

          <View style={styles.amountSection}>
            <View style={styles.amountHeader}>
              <Text style={styles.amountLabel}>
                {t('page.perpsDetail.PerpsClosePositionPopup.amount')}
              </Text>
            </View>
            <View style={styles.amountValueRow}>
              <View style={styles.amountValueContainer}>
                <Text style={styles.amountValue}>
                  ${splitNumberByStep(marginUsed.toFixed(2))}
                </Text>
                <Text style={styles.totalLabel}>
                  {t('page.perpsDetail.PerpsClosePositionPopup.total')}
                </Text>
              </View>
              <Text style={styles.percentageText}>{closePercent}%</Text>
            </View>
            <View style={styles.minimumWarningContainer}>
              {!isValidClosePercent && (
                <Text style={styles.minimumWarning}>
                  {t(
                    'page.perpsDetail.PerpsClosePositionPopup.minimumWarning',
                    {
                      percent: minClosePercent,
                    },
                  )}
                </Text>
              )}
            </View>
            <PerpsSlider
              step={1}
              value={closePercent}
              onValueChange={setClosePercent}
              showPercentage={false}
            />
          </View>

          <View style={styles.pnlCard}>
            <View style={styles.pnlCardRow}>
              <Text style={styles.pnlLabel}>
                {t('page.perpsDetail.PerpsClosePositionPopup.receive')}
              </Text>
              <Text style={[styles.pnlValue]}>
                {'+'}$
                {splitNumberByStep(
                  ((marginUsed * closePercent) / 100).toFixed(2),
                )}
              </Text>
            </View>
            <View style={styles.pnlCardRow}>
              <Text style={styles.pnlLabel}>
                {t('page.perpsDetail.PerpsClosePositionPopup.closedPnl')}
              </Text>
              <Text
                style={[
                  styles.pnlValue,
                  closedPnl >= 0 ? styles.green : styles.red,
                ]}>
                {closedPnl >= 0 ? '+' : '-'}$
                {splitNumberByStep(Math.abs(closedPnl).toFixed(2))}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => {
              showTipsPopup({
                title: t('page.perpsDetail.PerpsClosePositionPopup.fee'),
                desc:
                  t('page.perpsDetail.PerpsClosePositionPopup.rabbyFeeTips') +
                  '\n' +
                  t(
                    'page.perpsDetail.PerpsClosePositionPopup.providerFeeTips',
                    {
                      fee: formatPercent(providerFee, 4),
                    },
                  ),
              });
            }}>
            <View style={styles.feeContainer}>
              <Text style={styles.fee}>
                {t('page.perpsDetail.PerpsClosePositionPopup.fee')}:{' '}
                {formatPercent(bothFee, 4)}
              </Text>
              <RcIconInfoCC
                color={colors2024['neutral-info']}
                width={18}
                height={18}
              />
            </View>
          </TouchableOpacity>

          <Button
            type="primary"
            title={t('page.perpsDetail.PerpsClosePositionPopup.confirm')}
            loading={loading}
            disabled={!isValidClosePercent}
            onPress={closePosition}
          />
        </AutoLockView>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => {
  return {
    container: {
      height: '100%',
      paddingBottom: 56,
      paddingHorizontal: 20,
    },
    title: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
      color: colors2024['neutral-title-1'],
      marginBottom: 20,
      textAlign: 'center',
    },
    amountSection: {
      backgroundColor: colors2024['neutral-bg-2'],
      borderWidth: 1,
      borderColor: colors2024['neutral-line'],
      borderRadius: 20,
      paddingVertical: 16,
      paddingBottom: 20,
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    amountHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    amountLabel: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
      color: colors2024['brand-default'],
    },
    percentageText: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 36,
      lineHeight: 42,
      fontWeight: '900',
      color: colors2024['brand-default'],
    },
    amountValueContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    amountValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 42,
    },
    amountValue: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
      color: colors2024['neutral-title-1'],
    },
    totalLabel: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 18,
      lineHeight: 22,
      fontWeight: '700',
      color: colors2024['neutral-info'],
    },
    minimumWarning: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['red-default'],
    },
    minimumWarningContainer: {
      marginBottom: 16,
      // marginTop: -4,
      height: 14,
    },
    pnlCardRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    pnlCard: {
      borderWidth: 1,
      borderColor: colors2024['neutral-line'],
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 16,
      flexDirection: 'column',
      gap: 12,
      width: '100%',
      alignContent: 'center',
      alignItems: 'center',
      marginBottom: 30,
    },
    pnlLabel: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['neutral-foot'],
    },
    pnlValue: {
      fontFamily: 'SF Pro Rounded',
      color: colors2024['neutral-title-1'],
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '900',
    },
    red: {
      color: colors2024['red-default'],
    },
    green: {
      color: colors2024['green-default'],
    },
    feeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginBottom: 20,
    },
    fee: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '400',
      fontFamily: 'SF Pro Rounded',
      color: colors2024['neutral-foot'],
    },
  };
});

import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { sinceTime } from '@/utils/time';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { WsFill } from '@rabby-wallet/hyperliquid-sdk';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, useWindowDimensions, View } from 'react-native';

export const PerpsHistoryDetailPopup: React.FC<{
  visible?: boolean;
  onClose?(): void;
  fill: (WsFill & { logoUrl: string }) | null;
  orderTpOrSl?: 'tp' | 'sl';
}> = ({ visible, onClose, fill, orderTpOrSl }) => {
  const modalRef = useRef<AppBottomSheetModal>(null);

  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyle,
  });

  const { t } = useTranslation();

  const { coin, side, sz, px, closedPnl, time, fee, dir } = fill || {};
  const tradeValue = Number(sz) * Number(px);
  const pnlValue = Number(closedPnl) - Number(fee);
  const isClose = (dir === 'Close Long' || dir === 'Close Short') && closedPnl;
  const logoUrl = fill?.logoUrl;

  const titleString = useMemo(() => {
    const isLiquidation = Boolean(fill?.liquidation);
    if (fill?.dir === 'Close Long') {
      if (orderTpOrSl === 'tp') {
        return t('page.perps.historyDetail.title.closeLongTp');
      }
      if (orderTpOrSl === 'sl') {
        return t('page.perps.historyDetail.title.closeLongSl');
      }

      return isLiquidation
        ? t('page.perps.historyDetail.title.closeLongLiquidation')
        : t('page.perps.historyDetail.title.closeLong');
    }
    if (fill?.dir === 'Close Short') {
      if (orderTpOrSl === 'tp') {
        return t('page.perps.historyDetail.title.closeShortTp');
      }
      if (orderTpOrSl === 'sl') {
        return t('page.perps.historyDetail.title.closeShortSl');
      }

      return isLiquidation
        ? t('page.perps.historyDetail.title.closeShortLiquidation')
        : t('page.perps.historyDetail.title.closeShort');
    }
    if (fill?.dir === 'Open Long') {
      return t('page.perps.historyDetail.title.openLong');
    }
    if (fill?.dir === 'Open Short') {
      return t('page.perps.historyDetail.title.openShort');
    }
    return fill?.dir;
  }, [fill?.dir, fill?.liquidation, orderTpOrSl, t]);

  const { height } = useWindowDimensions();
  const maxHeight = useMemo(() => {
    return height - 200;
  }, [height]);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.dismiss();
    }
  }, [visible]);

  return (
    <>
      <AppBottomSheetModal
        ref={modalRef}
        // snapPoints={snapPoints}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg1',
        })}
        onDismiss={onClose}
        enableDynamicSizing
        // snapPoints={[376]}
        maxDynamicContentSize={maxHeight}>
        <BottomSheetView>
          <AutoLockView style={[styles.container]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{titleString}</Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
              <View style={styles.card}>
                {/* Perps */}
                <View style={styles.row}>
                  <Text style={styles.label}>{t('page.perps.title')}</Text>
                  <View style={styles.coinContainer}>
                    {/* <TokenImg logoUrl={logoUrl} size={20} /> */}
                    <Text style={styles.value}>{coin} - USD</Text>
                  </View>
                </View>

                {/* Date */}
                {time && (
                  <View style={styles.row}>
                    <Text style={styles.label}>
                      {t('page.perps.historyDetail.date')}
                    </Text>
                    <Text style={styles.value}>{sinceTime(time / 1000)}</Text>
                  </View>
                )}

                {Boolean(isClose) && (
                  <View style={styles.row}>
                    <Text style={styles.label}>
                      {t('page.perps.historyDetail.closedPnl')}
                    </Text>
                    <Text
                      style={[
                        styles.value,
                        pnlValue > 0 ? styles.positive : styles.negative,
                      ]}>
                      {pnlValue > 0 ? '+' : '-'}$
                      {splitNumberByStep(Math.abs(pnlValue).toFixed(2))}
                    </Text>
                  </View>
                )}

                {/* Price */}
                <View style={styles.row}>
                  <Text style={styles.label}>{t('page.perps.price')}</Text>
                  <Text style={styles.value}>
                    ${splitNumberByStep(px || 0)}
                  </Text>
                </View>

                {/* Size */}
                <View style={styles.row}>
                  <Text style={styles.label}>{t('page.perps.size')}</Text>
                  <Text style={styles.value}>
                    {sz} {coin}
                  </Text>
                </View>

                {/* Trade Value */}
                <View style={styles.row}>
                  <Text style={styles.label}>
                    {t('page.perps.historyDetail.tradeValue')}
                  </Text>
                  <Text style={styles.value}>
                    ${splitNumberByStep(tradeValue.toFixed(2))}
                  </Text>
                </View>

                {/* Fee */}
                {fee && (
                  <View style={styles.row}>
                    <Text style={styles.label}>{t('page.perps.fee')}</Text>
                    <Text style={styles.value}>
                      ${splitNumberByStep(Number(fee).toFixed(4))}
                    </Text>
                  </View>
                )}

                {/* Provider */}
                <View style={styles.row}>
                  <Text style={styles.label}>
                    {t('page.perps.historyDetail.provider')}
                  </Text>
                  <Text style={styles.value}>Hyperliquid</Text>
                </View>
              </View>
            </View>
            <Button
              type="primary"
              title={t('page.perps.PerpsDepositPopup.depositBtn')}
              // onPress={handleDeposit}
              // loading={loading}
            />
          </AutoLockView>
        </BottomSheetView>
      </AppBottomSheetModal>
    </>
  );
};

const getStyle = createGetStyles2024(ctx => {
  return {
    container: {
      height: '100%',
      backgroundColor: ctx.colors2024['neutral-bg-1'],
      paddingBottom: 56,
      paddingHorizontal: 20,
      display: 'flex',
      flexDirection: 'column',
    },

    header: {},

    formItem: {
      flex: 1,
    },
    formItemLabelRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    formItemLabel: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: ctx.colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
    },
    formItemDesc: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: ctx.colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
    },
    inputContainer: {
      borderRadius: 16,
      paddingVertical: 28,
      paddingHorizontal: 20,
      backgroundColor: ctx.colors2024['neutral-bg-2'],
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    input: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 28,
      // lineHeight: 36,
      fontWeight: '700',
      // color: ctx.colors2024['neutral-body'],
      flex: 1,
    },
    inputError: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '500',
      color: ctx.colors2024['neutral-error'],
      backgroundColor: ctx.colors2024['neutral-bg-2'],
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderColor: ctx.colors2024['neutral-error'],
      borderWidth: 1,
    },
    title: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '800',
      color: ctx.colors2024['neutral-title-1'],
      marginBottom: 24,
      textAlign: 'center',
    },
    divider: {
      width: 1,
      height: 28,
      backgroundColor: ctx.colors2024['neutral-line'],
    },
    tokenContainer: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      padding: 4,
      backgroundColor: ctx.colors2024['neutral-line'],
      borderRadius: 100,
    },
    tokenText: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: ctx.colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
    },
  };
});

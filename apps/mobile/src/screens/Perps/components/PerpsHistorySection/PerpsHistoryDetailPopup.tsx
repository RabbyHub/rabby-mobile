import RcIconInfoCC from '@/assets2024/icons/perps/IconInfoCC.svg';
import { AssetAvatar } from '@/components';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { useTipsPopup } from '@/hooks/useTipsPopup';
import { formatPercent } from '@/screens/Home/utils/price';
import { splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { sinceTime } from '@/utils/time';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { WsFill } from '@rabby-wallet/hyperliquid-sdk';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

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
  const { showTipsPopup } = useTipsPopup();

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
      modalRef.current?.close();
    }
  }, [visible]);

  return (
    <>
      <AppBottomSheetModal
        ref={modalRef}
        // snapPoints={snapPoints}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: isLight ? 'bg2' : 'bg1',
        })}
        onDismiss={onClose}
        enableDynamicSizing
        // snapPoints={[568]}
        maxDynamicContentSize={maxHeight}>
        <BottomSheetView>
          <AutoLockView style={[styles.container]}>
            <View>
              <Text style={styles.title}>{titleString}</Text>
            </View>
            <View style={styles.list}>
              <View style={styles.listItem}>
                <View style={styles.listItemMain}>
                  <Text style={styles.label}>
                    {t('page.perps.historyDetail.perps')}
                  </Text>
                </View>
                <View style={styles.coinContainer}>
                  <AssetAvatar size={24} logo={logoUrl} />
                  <Text style={styles.value}>{coin} - USD</Text>
                </View>
              </View>
              {time ? (
                <View style={styles.listItem}>
                  <View style={styles.listItemMain}>
                    <Text style={styles.label}>
                      {t('page.perps.historyDetail.date')}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.value}>{sinceTime(time / 1000)}</Text>
                  </View>
                </View>
              ) : null}
              {isClose ? (
                <View style={styles.listItem}>
                  <View style={styles.listItemMain}>
                    <Text style={styles.label}>
                      {t('page.perps.historyDetail.closedPnl')}
                    </Text>
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.value,
                        pnlValue > 0 ? styles.green : styles.red,
                      ]}>
                      {pnlValue > 0 ? '+' : '-'}$
                      {splitNumberByStep(Math.abs(pnlValue).toFixed(2))}
                    </Text>
                  </View>
                </View>
              ) : null}
              <View style={styles.listItem}>
                <View style={styles.listItemMain}>
                  <Text style={styles.label}>
                    {t('page.perps.historyDetail.price')}
                  </Text>
                </View>
                <View>
                  <Text style={styles.value}>
                    ${splitNumberByStep(px || 0)}
                  </Text>
                </View>
              </View>
              <View style={styles.listItem}>
                <TouchableOpacity
                  onPress={() => {
                    showTipsPopup({
                      title: t('page.perps.historyDetail.size'),
                      desc: t('page.perps.historyDetail.sizeTips'),
                    });
                  }}>
                  <View style={styles.listItemMain}>
                    <Text style={styles.label}>
                      {t('page.perps.historyDetail.size')}
                    </Text>
                    <RcIconInfoCC
                      width={18}
                      height={18}
                      color={colors2024['neutral-info']}
                    />
                  </View>
                </TouchableOpacity>
                <View>
                  <Text style={styles.value}>
                    ${splitNumberByStep(tradeValue.toFixed(2))} = {sz} {coin}
                  </Text>
                </View>
              </View>
              {fee ? (
                <View style={styles.listItem}>
                  <View style={styles.listItemMain}>
                    <Text style={styles.label}>
                      {t('page.perps.historyDetail.fee')}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.value}>
                      ${splitNumberByStep(Number(fee).toFixed(4))}
                    </Text>
                  </View>
                </View>
              ) : null}
              <View style={styles.listItem}>
                <View style={styles.listItemMain}>
                  <Text style={styles.label}>
                    {t('page.perps.historyDetail.provider')}
                  </Text>
                </View>
                <View>
                  <Text style={styles.value}>Hyperliquid</Text>
                </View>
              </View>
            </View>

            <Button
              type="primary"
              title={t('page.perps.historyDetail.gotItBtn')}
              onPress={onClose}
            />
          </AutoLockView>
        </BottomSheetView>
      </AppBottomSheetModal>
    </>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => {
  return {
    container: {
      // height: '100%',
      // backgroundColor: colors2024['neutral-bg-1'],
      paddingBottom: 56,
      paddingHorizontal: 20,
      display: 'flex',
      flexDirection: 'column',
    },

    title: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
      color: colors2024['neutral-title-1'],
      marginBottom: 16,
      textAlign: 'center',
    },
    list: {
      borderRadius: 16,
      backgroundColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
      marginBottom: 52,
    },
    listItemContainer: {
      padding: 16,
    },
    listItem: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      justifyContent: 'space-between',
    },
    listItemRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    listSub: {
      padding: 12,
      backgroundColor: colors2024['neutral-bg-2'],
      borderRadius: 6,
      marginTop: 12,
    },
    listSubItem: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 28,
    },
    listSubItemLabel: {
      flex: 1,
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['neutral-foot'],
    },
    listItemMain: {
      flex: 1,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 20,
    },
    label: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['neutral-foot'],
    },
    labelInfo: {
      color: colors2024['neutral-info'],
    },
    value: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
    },
    coinContainer: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    green: {
      color: colors2024['green-default'],
    },
    red: {
      color: colors2024['red-default'],
    },
  };
});

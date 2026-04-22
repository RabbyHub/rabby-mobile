import RcIconInfoCC from '@/assets2024/icons/perps/IconInfoCC.svg';
import RcIconHyper from '@/assets2024/icons/perps/IconHyper.svg';
import RcIconRabby from '@/assets2024/icons/common/rabby-wallet.svg';
import { AssetAvatar } from '@/components';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { useTipsPopup } from '@/hooks/useTipsPopup';
import { formatPercent } from '@/screens/Home/utils/price';
import { formatPerpsNumber, splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { sinceTime } from '@/utils/time';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { WsFill } from '@rabby-wallet/hyperliquid-sdk';
import React, { useEffect, useMemo, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Text } from '@/components/Typography';
import { SPOT_STABLE_COIN_NAME } from '../PerpsSpotSwapPopup';
import { formatPerpsCoin } from '@/utils/perps';

// Reverse map: '@166' → 'USDT', '@150' → 'USDE', '@230' → 'USDH'
const SPOT_COIN_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(SPOT_STABLE_COIN_NAME).map(([name, id]) => [id, name]),
);

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

  // Stablecoin swap detection
  const stableCoinName = coin ? SPOT_COIN_TO_NAME[coin] : '';
  const isStableCoinTrade = Boolean(stableCoinName);

  const titleString = useMemo(() => {
    if (isStableCoinTrade) {
      return `${fill?.dir} ${stableCoinName}`;
    }
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
  }, [
    fill?.dir,
    fill?.liquidation,
    orderTpOrSl,
    t,
    isStableCoinTrade,
    stableCoinName,
  ]);

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
              {isStableCoinTrade ? (
                <>
                  <View style={styles.listItem}>
                    <View style={styles.listItemMain}>
                      <Text style={styles.label}>
                        {t('page.perps.historyDetail.action')}
                      </Text>
                    </View>
                    <Text style={styles.value}>{dir}</Text>
                  </View>
                  <View style={styles.listItem}>
                    <View style={styles.listItemMain}>
                      <Text style={styles.label}>
                        {t('page.perps.historyDetail.asset')}
                      </Text>
                    </View>
                    <Text style={styles.value}>{stableCoinName}</Text>
                  </View>
                  <View style={styles.listItem}>
                    <View style={styles.listItemMain}>
                      <Text style={styles.label}>
                        {t('page.perps.historyDetail.amount')}
                      </Text>
                    </View>
                    <Text style={styles.value}>
                      {sz} {stableCoinName}
                    </Text>
                  </View>
                  <View style={styles.listItem}>
                    <View style={styles.listItemMain}>
                      <Text style={styles.label}>
                        {t('page.perps.historyDetail.price')}
                      </Text>
                    </View>
                    <Text style={styles.value}>
                      {formatPerpsNumber(px || 0, 4)} USDC
                    </Text>
                  </View>
                  <View style={styles.listItem}>
                    <View style={styles.listItemMain}>
                      <Text style={styles.label}>
                        {t('page.perps.historyDetail.fee')}
                      </Text>
                    </View>
                    <Text style={styles.value}>
                      {formatPerpsNumber(fee || '0', 4)} {stableCoinName}
                    </Text>
                  </View>
                  {time ? (
                    <View style={styles.listItem}>
                      <View style={styles.listItemMain}>
                        <Text style={styles.label}>
                          {t('page.perps.historyDetail.date')}
                        </Text>
                      </View>
                      <Text style={styles.value}>{sinceTime(time / 1000)}</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <View style={styles.listItem}>
                    <View style={styles.listItemMain}>
                      <Text style={styles.label}>
                        {t('page.perps.historyDetail.perps')}
                      </Text>
                    </View>
                    <View style={styles.coinContainer}>
                      <AssetAvatar size={24} logo={logoUrl} />
                      <Text style={styles.value}>
                        {formatPerpsCoin(coin || '')} - USD
                      </Text>
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
                        <Text style={styles.value}>
                          {sinceTime(time / 1000)}
                        </Text>
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
                          buttonType: 'hyperliquid',
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
                        ${splitNumberByStep(tradeValue.toFixed(2))} = {sz}{' '}
                        {formatPerpsCoin(coin || '')}
                      </Text>
                    </View>
                  </View>
                  {fee ? (
                    <View style={styles.listItem}>
                      <TouchableOpacity
                        onPress={() => {
                          showTipsPopup({
                            title: t('page.perps.historyDetail.feeTitle'),
                            desc: (
                              <View>
                                <Text style={styles.feeDesc}>
                                  <Trans
                                    i18nKey="page.perps.historyDetail.feeDesc"
                                    components={{
                                      1: <Text style={styles.feeBold} />,
                                      2: <Text style={styles.feeBold} />,
                                    }}
                                  />
                                </Text>
                                <View style={styles.feeTable}>
                                  <View style={styles.feeRow}>
                                    <View style={styles.feeRowLeft}>
                                      <RcIconHyper width={20} height={20} />
                                      <Text style={styles.feeRowLabel}>
                                        {t(
                                          'page.perps.historyDetail.feeHyperliquid',
                                        )}
                                      </Text>
                                    </View>
                                    <Text style={styles.feeRowValue}>
                                      0.045%
                                    </Text>
                                  </View>
                                  <View style={styles.feeRow}>
                                    <View style={styles.feeRowLeft}>
                                      <RcIconRabby width={20} height={20} />
                                      <Text style={styles.feeRowLabel}>
                                        {t('page.perps.historyDetail.feeRabby')}
                                      </Text>
                                    </View>
                                    <Text style={styles.feeRowValue}>
                                      0.02%
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            ),
                            buttonType: 'hyperliquid',
                          });
                        }}>
                        <View style={styles.listItemMain}>
                          <Text style={styles.label}>
                            {t('page.perps.historyDetail.fee')}
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
                </>
              )}
            </View>

            <Button
              type="hyperliquid"
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
      color: colors2024['neutral-secondary'],
    },
    labelInfo: {
      color: colors2024['neutral-info'],
    },
    value: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '500',
      color: colors2024['neutral-body'],
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
    feeDesc: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '400',
      color: colors2024['neutral-secondary'],
      textAlign: 'center',
      marginBottom: 20,
    },
    feeBold: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
    },
    feeTable: {
      borderRadius: 12,
      backgroundColor: colors2024['neutral-bg-2'],
      overflow: 'hidden',
    },
    feeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 0.5,
      borderBottomColor: colors2024['neutral-line'],
    },
    feeRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    feeRowLabel: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['neutral-title-1'],
    },
    feeRowValue: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
    },
  };
});

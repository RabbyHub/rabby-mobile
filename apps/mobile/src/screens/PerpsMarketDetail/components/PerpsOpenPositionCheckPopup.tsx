import RcIconInfoCC from '@/assets2024/icons/perps/IconInfoCC.svg';
import { AppSwitch, AssetAvatar } from '@/components';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { useTipsPopup } from '@/hooks/useTipsPopup';
import { formatPercent } from '@/screens/Home/utils/price';
import { formatUsdValue, splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import {
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

export const PerpsOpenPositionCheckPopup: React.FC<{
  visible?: boolean;
  onClose?(): void;
  onConfirm?(): Promise<void>;
  info: {
    coin: string;
    coinLogo?: string;
    margin: string;
    direction: 'Long' | 'Short';
    leverage: number;
    tradeAmount: number;
    tradeSize: string;
    markPrice: number;
    providerFee: number;
    bothFee: number;
    tpTriggerPx: string;
    slTriggerPx: string;
    selectedMarginMode: 'cross' | 'isolated';
    estimatedLiquidationPrice: string | number;
  };
}> = ({ visible, onClose, info, onConfirm }) => {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const [loading, setLoading] = React.useState<boolean>(false);
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyle,
  });

  const { showTipsPopup } = useTipsPopup();

  const {
    coin: coin,
    coinLogo,
    margin,
    direction,
    leverage,
    tradeAmount,
    tradeSize,
    markPrice,
    providerFee,
    bothFee,
    estimatedLiquidationPrice,
    tpTriggerPx,
    slTriggerPx,
    selectedMarginMode,
  } = info;

  const { t } = useTranslation();

  const { height } = useWindowDimensions();
  const maxHeight = useMemo(() => {
    return height - 100;
  }, [height]);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
      setLoading(false);
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      // snapPoints={snapPoints}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: isLight ? 'bg0' : 'bg1',
      })}
      onDismiss={onClose}
      snapPoints={[maxHeight]}>
      <AutoLockView style={[styles.container]}>
        <BottomSheetScrollView contentContainerStyle={styles.scrollViewContent}>
          <View>
            <Text style={styles.title}>
              {t('page.perpsDetail.PerpsOpenPositionCheckPopup.title')}
            </Text>
          </View>

          <View style={styles.list}>
            <View style={styles.listItem}>
              <View style={styles.listItemMain}>
                <Text style={styles.label}>
                  {t('page.perpsDetail.PerpsOpenPositionCheckPopup.perps')}
                </Text>
              </View>
              <View style={styles.coinContainer}>
                <AssetAvatar size={24} logo={coinLogo} />
                <Text style={styles.value}>{coin} - USD</Text>
              </View>
            </View>
            <View style={styles.listItem}>
              <View style={styles.listItemMain}>
                <Text style={styles.label}>
                  {t(
                    selectedMarginMode === 'cross'
                      ? 'page.perpsDetail.PerpsOpenPositionCheckPopup.marginCross'
                      : 'page.perpsDetail.PerpsOpenPositionCheckPopup.margin',
                  )}
                </Text>
              </View>
              <View>
                <Text style={styles.value}>
                  {formatUsdValue(Number(margin))}
                </Text>
              </View>
            </View>
            <View style={styles.listItem}>
              <View style={styles.listItemMain}>
                <Text style={styles.label}>
                  {t('page.perpsDetail.PerpsOpenPositionCheckPopup.direction')}
                </Text>
              </View>
              <View>
                <Text style={styles.value}>
                  {direction} {leverage}x
                </Text>
              </View>
            </View>
            <View style={styles.listItem}>
              <TouchableOpacity
                onPress={() => {
                  showTipsPopup({
                    title: t(
                      'page.perpsDetail.PerpsOpenPositionCheckPopup.size',
                    ),
                    desc: t(
                      'page.perpsDetail.PerpsOpenPositionCheckPopup.sizeTips',
                    ),
                  });
                }}>
                <View style={styles.listItemMain}>
                  <Text style={styles.label}>
                    {t('page.perpsDetail.PerpsOpenPositionCheckPopup.size')}
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
                  {formatUsdValue(Number(tradeAmount))} = {tradeSize} {coin}
                </Text>
              </View>
            </View>
            {tpTriggerPx ? (
              <View style={styles.listItem}>
                <View style={styles.listItemMain}>
                  <Text style={styles.label}>
                    {t('page.perpsDetail.PerpsPosition.tpPrice')}
                  </Text>
                </View>
                <View>
                  <Text style={styles.value}>
                    ${splitNumberByStep(Number(tpTriggerPx))}
                  </Text>
                </View>
              </View>
            ) : null}
            {slTriggerPx ? (
              <View style={styles.listItem}>
                <View style={styles.listItemMain}>
                  <Text style={styles.label}>
                    {t('page.perpsDetail.PerpsPosition.slPrice')}
                  </Text>
                </View>
                <View>
                  <Text style={styles.value}>
                    ${splitNumberByStep(Number(slTriggerPx))}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
          <View style={styles.list}>
            <View style={styles.listItem}>
              <View style={styles.listItemMain}>
                <Text style={styles.label}>
                  {coin}-USD{' '}
                  {t('page.perpsDetail.PerpsOpenPositionCheckPopup.price')}
                </Text>
              </View>
              <View>
                <Text style={styles.value}>
                  ${splitNumberByStep(markPrice)}
                </Text>
              </View>
            </View>
            <View style={styles.listItem}>
              <TouchableOpacity
                onPress={() => {
                  showTipsPopup({
                    title: t(
                      'page.perpsDetail.PerpsOpenPositionCheckPopup.estLqPrice',
                    ),
                    desc: t(
                      'page.perpsDetail.PerpsOpenPositionCheckPopup.liquidationPriceTips',
                    ),
                  });
                }}>
                <View style={styles.listItemMain}>
                  <Text style={styles.label}>
                    {t(
                      'page.perpsDetail.PerpsOpenPositionCheckPopup.estLqPrice',
                    )}
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
                  ${splitNumberByStep(Number(estimatedLiquidationPrice))}
                </Text>
              </View>
            </View>

            <View style={styles.listItem}>
              <View style={styles.listItemMain}>
                <Text style={styles.label}>
                  {t('page.perpsDetail.PerpsOpenPositionCheckPopup.rabbyFee')}
                </Text>
              </View>
              <View style={styles.listTagRow}>
                <View style={styles.tagContainer}>
                  <Text style={styles.tagText}>
                    {t('page.perpsDetail.PerpsOpenPositionCheckPopup.free')}
                  </Text>
                </View>
                <Text style={styles.value}>0%</Text>
              </View>
            </View>
            <View style={styles.listItem}>
              <View style={styles.listItemMain}>
                <Text style={styles.label}>
                  {t(
                    'page.perpsDetail.PerpsOpenPositionCheckPopup.providerFee',
                  )}
                </Text>
              </View>
              <View>
                <Text style={styles.value}>
                  {formatPercent(providerFee, 4)}
                </Text>
              </View>
            </View>
          </View>
        </BottomSheetScrollView>
        <View style={styles.footer}>
          <Button
            type="primary"
            title={t('page.perpsDetail.PerpsOpenPositionCheckPopup.btn', {
              direction,
            })}
            onPress={async () => {
              setLoading(true);
              await onConfirm?.();
              setLoading(false);
            }}
            loading={loading}
          />
        </View>
      </AutoLockView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => {
  return {
    container: {
      height: '100%',
      // paddingBottom: 56,
      // paddingHorizontal: 20,
      // minHeight: 544,
    },
    scrollViewContent: {
      paddingHorizontal: 20,
      flex: 1,
    },
    footer: {
      backgroundColor: colors2024['neutral-bg-1'],
      paddingTop: 12,
      paddingHorizontal: 16,
      paddingBottom: 56,
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
      marginBottom: 18,
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
    tagContainer: {
      paddingVertical: 2,
      paddingHorizontal: 6,
      backgroundColor: colors2024['brand-light-1'],
      borderRadius: 4,
    },
    listTagRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    tagText: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
      color: colors2024['brand-default'],
    },
  };
});

import React, { useEffect, useMemo, useRef } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Trans, useTranslation } from 'react-i18next';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import RcIconInfoCC from '@/assets2024/icons/perps/IconInfoCC.svg';
import RcImgSafe from '@/assets2024/icons/perps/ImgSafe.svg';
import RcImgTipsLightCC from '@/assets2024/icons/perps/ImgTipsLightCC.svg';
import RcImgWarning from '@/assets2024/icons/perps/ImgWarning.svg';
import RcImgDanger from '@/assets2024/icons/perps/ImgDanger.svg';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import AutoLockView from '@/components/AutoLockView';
import { Button } from '@/components2024/Button';
import { PERPS_POSITION_RISK_LEVEL } from '@/constant/perps';
import { splitNumberByStep } from '@/utils/number';
import { useTipsPopup } from '@/hooks/useTipsPopup';
import { getRiskLevel } from './utils';

const formatPct = (v: number) => `${(v * 100).toFixed(2)}%`;

interface PerpsRiskLevelPopupProps {
  visible: boolean;
  onClose: () => void;
  distanceLiquidation: number;
  pxDecimals: number;
  currentPrice: number;
  liquidationPrice: number;
  direction: 'Long' | 'Short';
}

export const PerpsRiskLevelPopup: React.FC<PerpsRiskLevelPopupProps> = ({
  visible,
  onClose,
  distanceLiquidation,
  currentPrice,
  liquidationPrice,
  pxDecimals,
  direction,
}) => {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyles,
  });
  const { t } = useTranslation();

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
        linearGradientType: isLight ? 'bg0' : 'bg1',
      })}
      onDismiss={onClose}
      enableDynamicSizing>
      <BottomSheetView>
        <AutoLockView style={styles.container}>
          <View style={styles.imgContainer}>
            <RcImgTipsLightCC
              width={35}
              height={35}
              color={colors2024['neutral-info']}
            />
          </View>
          <Text style={styles.title}>
            {t('page.perps.PerpsRiskPopup.distanceLabel')}
          </Text>

          <View style={styles.priceList}>
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>
                {t('page.perps.PerpsRiskPopup.currentPrice')}
              </Text>
              <Text style={styles.priceValue}>
                ${splitNumberByStep(currentPrice.toFixed(pxDecimals))}
              </Text>
            </View>
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>
                {t('page.perps.PerpsRiskPopup.liquidationPrice')}
              </Text>
              <Text style={styles.priceValue}>
                ${splitNumberByStep(liquidationPrice.toFixed(pxDecimals))}
              </Text>
            </View>
            <View style={styles.priceItem}>
              <View style={styles.distanceCard}>
                <Text style={styles.desc}>
                  <Trans
                    t={t}
                    i18nKey={
                      direction === 'Long'
                        ? t('page.perps.PerpsRiskPopup.liqDistanceTipsLong', {
                            distance: formatPct(distanceLiquidation),
                          })
                        : t('page.perps.PerpsRiskPopup.liqDistanceTipsShort', {
                            distance: formatPct(distanceLiquidation),
                          })
                    }
                    components={{
                      1: <Text style={styles.strong} />,
                    }}
                  />
                </Text>
              </View>
            </View>
          </View>
        </AutoLockView>
        <View style={styles.footer}>
          <Button type="primary" title={t('global.gotIt')} onPress={onClose} />
        </View>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    paddingHorizontal: 20,
    // paddingBottom: 56,
  },
  imgContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
    marginBottom: 20,
  },
  gaugeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    position: 'relative',
    height: 145,
  },
  desc: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
  },
  strong: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    color: colors2024['neutral-body'],
  },
  riskLabel: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    position: 'absolute',
    bottom: 0,
    textAlign: 'center',
  },
  distanceCard: {
    borderRadius: 6,
    paddingTop: 10,
    paddingBottom: 10,
    flex: 1,
    backgroundColor: colors2024['neutral-bg-5'],
  },
  distanceLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceLabel: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
  distanceValue: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  priceList: {
    borderRadius: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  priceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  priceLabel: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
  priceValue: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 48,
    // backgroundColor: colors2024['neutral-bg-1'],
  },
}));

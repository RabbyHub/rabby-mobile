import React, { useEffect, useMemo, useRef } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { RcIconInfoFill1CC } from '@/assets/icons/common';
import RcImgSafe from '@/assets2024/icons/perps/ImgSafe.svg';
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
  currentPrice: number;
  liquidationPrice: number;
}

// Risk Gauge Component
const RiskGauge: React.FC<{
  riskLevel: PERPS_POSITION_RISK_LEVEL;
  riskConfig: {
    label: string;
    color: string;
    ImageComponent: React.FC<any>;
  };
}> = ({ riskConfig }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { ImageComponent } = riskConfig;

  return (
    <View style={styles.gaugeContainer}>
      <ImageComponent width={240} height={140} />
      <Text style={[styles.riskLabel, { color: riskConfig.color }]}>
        {riskConfig.label}
      </Text>
    </View>
  );
};

export const PerpsRiskLevelPopup: React.FC<PerpsRiskLevelPopupProps> = ({
  visible,
  onClose,
  distanceLiquidation,
  currentPrice,
  liquidationPrice,
}) => {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyles,
  });
  const { t } = useTranslation();
  const { showTipsPopup } = useTipsPopup();

  const riskLevel = useMemo(() => {
    return getRiskLevel(distanceLiquidation);
  }, [distanceLiquidation]);

  const riskConfig = useMemo(() => {
    const configs = {
      [PERPS_POSITION_RISK_LEVEL.SAFE]: {
        label: t('page.perps.PerpsRiskPopup.level.safe'),
        color: colors2024['green-default'],
        backgroundColor: colors2024['green-light-4'],
        infoColor: colors2024['green-disable'],
        ImageComponent: RcImgSafe,
      },
      [PERPS_POSITION_RISK_LEVEL.WARNING]: {
        label: t('page.perps.PerpsRiskPopup.level.warning'),
        color: colors2024['orange-default'],
        backgroundColor: colors2024['orange-light-4'],
        infoColor: colors2024['orange-disable'],
        ImageComponent: RcImgWarning,
      },
      [PERPS_POSITION_RISK_LEVEL.DANGER]: {
        label: t('page.perps.PerpsRiskPopup.level.danger'),
        color: colors2024['red-default'],
        backgroundColor: colors2024['red-light-1'],
        infoColor: colors2024['red-disable'],
        ImageComponent: RcImgDanger,
      },
    };
    return configs[riskLevel];
  }, [riskLevel, colors2024, t]);

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
          <Text style={styles.title}>
            {t('page.perps.PerpsRiskPopup.title')}
          </Text>
          <Text style={styles.subtitle}>
            {t('page.perps.PerpsRiskPopup.subtitle')}
          </Text>

          <RiskGauge riskLevel={riskLevel} riskConfig={riskConfig} />

          <View
            style={[
              styles.distanceCard,
              { backgroundColor: riskConfig.backgroundColor },
            ]}>
            <TouchableOpacity
              style={styles.distanceLabelContainer}
              onPress={() => {
                showTipsPopup({
                  title: t('page.perps.PerpsRiskPopup.distanceLabel'),
                  desc: t('page.perps.PerpsRiskPopup.liqIntro'),
                });
              }}>
              <Text style={[styles.distanceLabel, { color: riskConfig.color }]}>
                {t('page.perps.PerpsRiskPopup.distanceLabel')}
              </Text>
              <RcIconInfoFill1CC
                width={16}
                height={16}
                color={riskConfig.infoColor}
              />
            </TouchableOpacity>
            <Text style={[styles.distanceValue, { color: riskConfig.color }]}>
              {formatPct(distanceLiquidation)}
            </Text>
          </View>

          <View style={styles.priceList}>
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>
                {t('page.perps.PerpsRiskPopup.currentPrice')}
              </Text>
              <Text style={styles.priceValue}>
                ${splitNumberByStep(currentPrice.toFixed(2))}
              </Text>
            </View>
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>
                {t('page.perps.PerpsRiskPopup.liquidationPrice')}
              </Text>
              <Text style={styles.priceValue}>
                ${splitNumberByStep(liquidationPrice.toFixed(2))}
              </Text>
            </View>
          </View>

          <Button type="primary" title={t('global.gotIt')} onPress={onClose} />
        </AutoLockView>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 56,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    marginBottom: 8,
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
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
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
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    marginBottom: 24,
  },
  priceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
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
}));

import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { getPerpsProInputDialogStyles } from '../common/perpsProDialogVisual';
import { PerpsProDialogBackdrop } from '../common/PerpsProDialogBackdrop';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';
import FlatLight from '@/assets2024/icons/perps/scale-flat-light.svg';
import FlatDark from '@/assets2024/icons/perps/scale-flat-dark.svg';
import AscendingLight from '@/assets2024/icons/perps/scale-ascending-light.svg';
import AscendingDark from '@/assets2024/icons/perps/scale-ascending-dark.svg';
import DescendingLight from '@/assets2024/icons/perps/scale-descending-light.svg';
import DescendingDark from '@/assets2024/icons/perps/scale-descending-dark.svg';

// Exported from the six light/dark chart nodes in the approved Figma design.
const charts = {
  flat: [FlatLight, FlatDark],
  ascending: [AscendingLight, AscendingDark],
  descending: [DescendingLight, DescendingDark],
};

export const PerpsProScaleDistributionSheet = React.memo(
  ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
    const ref = useRef<AppBottomSheetModal>(null);
    const { t } = useTranslation();
    const { styles, colors2024, isLight } = useTheme2024({ getStyle });
    usePerpsProSheetNavigationRegistration({
      active: visible,
      dismiss: onClose,
    });
    useEffect(() => {
      if (visible) ref.current?.present();
      else ref.current?.close();
    }, [visible]);
    return (
      <AppBottomSheetModal
        ref={ref}
        onDismiss={onClose}
        enableDynamicSizing
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg1',
        })}
        backdropComponent={PerpsProDialogBackdrop}
        backgroundStyle={styles.background}
        handleStyle={styles.handle}
        handleIndicatorStyle={styles.handleIndicator}
        style={styles.modal}>
        <BottomSheetScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>
            {t('page.perps.pro.scaleOrder.distribution')}
          </Text>
          <View style={styles.sections}>
            {(['flat', 'ascending', 'descending'] as const).map(
              distribution => {
                const Chart = charts[distribution][isLight ? 0 : 1];
                return (
                  <View key={distribution} style={styles.section}>
                    <Text style={styles.label}>
                      {t(`page.perps.pro.scaleOrder.${distribution}`)}
                    </Text>
                    <Text style={styles.description}>
                      {t(
                        `page.perps.pro.scaleOrder.${distribution}Description`,
                      )}
                    </Text>
                    <View style={styles.chart}>
                      <Chart accessible={false} width="100%" height="100%" />
                    </View>
                  </View>
                );
              },
            )}
          </View>
        </BottomSheetScrollView>
      </AppBottomSheetModal>
    );
  },
);
PerpsProScaleDistributionSheet.displayName = 'PerpsProScaleDistributionSheet';
const getStyle = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => ({
    ...getPerpsProInputDialogStyles(colors2024, safeAreaInsets.bottom, isLight),
    sections: { marginTop: 24, gap: 8 },
    section: { paddingHorizontal: 8, paddingVertical: 16, gap: 4 },
    chart: { width: '100%', aspectRatio: 345 / 105.8 },
  }),
);

import { AppBottomSheetModal } from '@/components';
import { Text } from '@/components/Typography';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsProTpSlMode } from '../../model/tpsl';
import { getPerpsProDialogStyles } from '../common/perpsProDialogVisual';
import { PerpsProDialogBackdrop } from '../common/PerpsProDialogBackdrop';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';

export const PerpsProTpSlModeSheet: React.FC<{
  allowedModes?: readonly PerpsProTpSlMode[];
  onClose: () => void;
  onSelect: (mode: PerpsProTpSlMode) => void;
  selected: PerpsProTpSlMode;
  visible: boolean;
}> = React.memo(
  ({
    allowedModes = ['price', 'pnl', 'roi'],
    onClose,
    onSelect,
    selected,
    visible,
  }) => {
    const modalRef = useRef<AppBottomSheetModal>(null);
    const { colors2024, styles } = useTheme2024({ getStyle });
    usePerpsProSheetNavigationRegistration({
      active: visible,
      dismiss: onClose,
    });
    const { t } = useTranslation();

    useEffect(() => {
      if (visible) modalRef.current?.present();
      else modalRef.current?.close();
    }, [visible]);

    const allOptions: Array<{
      description: string;
      label: string;
      value: PerpsProTpSlMode;
    }> = [
      {
        description: t('page.perps.pro.trade.tpSlPriceDescription'),
        label: t('page.perps.pro.trade.price'),
        value: 'price',
      },
      {
        description: t('page.perps.pro.trade.tpSlPnlDescription'),
        label: t('page.perps.pro.trade.pnl'),
        value: 'pnl',
      },
      {
        description: t('page.perps.pro.trade.tpSlRoiDescription'),
        label: t('page.perps.pro.trade.roi'),
        value: 'roi',
      },
    ];
    const options = allOptions.filter(option =>
      allowedModes.includes(option.value),
    );

    return (
      <AppBottomSheetModal
        onDismiss={onClose}
        ref={modalRef}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg0',
        })}
        enableDynamicSizing
        backdropComponent={PerpsProDialogBackdrop}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handleIndicator}
        handleStyle={styles.handle}
        style={styles.modal}>
        <BottomSheetView style={styles.sheet}>
          <View style={styles.content}>
            <Text style={styles.title}>
              {t('page.perps.pro.trade.tpSlSettings')}
            </Text>
            <View style={styles.options}>
              {options.map(option => {
                const active = option.value === selected;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    key={option.value}
                    onPress={() => {
                      onSelect(option.value);
                      onClose();
                    }}
                    style={[
                      styles.option,
                      active ? styles.optionActive : styles.optionInactive,
                    ]}
                    testID={`perps-pro-tpsl-mode-${option.value}`}>
                    <View style={styles.copy}>
                      <Text style={styles.label}>{option.label}</Text>
                      <Text style={styles.description}>
                        {option.description}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </BottomSheetView>
      </AppBottomSheetModal>
    );
  },
);

PerpsProTpSlModeSheet.displayName = 'PerpsProTpSlModeSheet';

const getStyle = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => ({
    ...getPerpsProDialogStyles(colors2024, safeAreaInsets.bottom, isLight),
  }),
);

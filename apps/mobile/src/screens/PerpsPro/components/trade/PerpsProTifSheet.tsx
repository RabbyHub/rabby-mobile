import { AppBottomSheetModal } from '@/components';
import { Text } from '@/components/Typography';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsProTradeTif } from '../../model/trade';
import { getPerpsProDialogStyles } from '../common/perpsProDialogVisual';
import { PerpsProDialogBackdrop } from '../common/PerpsProDialogBackdrop';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';

export const PerpsProTifSheet: React.FC<{
  onClose: () => void;
  onSelect: (value: PerpsProTradeTif) => void;
  selected: PerpsProTradeTif;
  visible: boolean;
}> = React.memo(({ onClose, onSelect, selected, visible }) => {
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

  const options: Array<{
    description: string;
    label: string;
    value: PerpsProTradeTif;
  }> = [
    {
      description: t('page.perps.pro.trade.gtcDescription'),
      label: 'GTC',
      value: 'Gtc',
    },
    {
      description: t('page.perps.pro.trade.iocDescription'),
      label: 'IOC',
      value: 'Ioc',
    },
    {
      description: t('page.perps.pro.trade.aloDescription'),
      label: 'ALO',
      value: 'Alo',
    },
  ];

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
            {t('page.perps.pro.trade.timeInForce')}
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
                  testID={`perps-pro-tif-${option.value.toLowerCase()}`}>
                  <View style={styles.copy}>
                    <Text style={styles.label}>{option.label}</Text>
                    <Text style={styles.description}>{option.description}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
});

PerpsProTifSheet.displayName = 'PerpsProTifSheet';

const getStyle = createGetStyles2024(({ colors2024, safeAreaInsets }) => ({
  ...getPerpsProDialogStyles(colors2024, safeAreaInsets.bottom),
}));

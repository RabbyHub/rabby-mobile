import { AppBottomSheetModal } from '@/components';
import { Text } from '@/components/Typography';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getPerpsProDialogStyles } from '../common/perpsProDialogVisual';
import { PerpsProDialogBackdrop } from '../common/PerpsProDialogBackdrop';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';

type MarginMode = 'cross' | 'isolated';

export const PerpsProMarginModeSheet: React.FC<{
  disabledValues?: readonly MarginMode[];
  marketName: string;
  onClose: () => void;
  onSelect: (value: MarginMode) => Promise<boolean> | boolean;
  pending?: boolean;
  selected: MarginMode;
  visible: boolean;
}> = React.memo(
  ({
    disabledValues = [],
    marketName,
    onClose,
    onSelect,
    pending = false,
    selected,
    visible,
  }) => {
    const modalRef = useRef<AppBottomSheetModal>(null);
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    usePerpsProSheetNavigationRegistration({
      active: visible,
      dismiss: onClose,
      dismissible: !pending,
    });

    useEffect(() => {
      if (visible) modalRef.current?.present();
      else modalRef.current?.close();
    }, [visible]);

    const options: Array<{
      description: string;
      label: string;
      value: MarginMode;
    }> = [
      {
        description: t('page.perps.pro.trade.crossDescription'),
        label: t('page.perps.pro.positions.cross'),
        value: 'cross',
      },
      {
        description: t('page.perps.pro.trade.isolatedDescription'),
        label: t('page.perps.pro.trade.isolated'),
        value: 'isolated',
      },
    ];

    return (
      <AppBottomSheetModal
        enablePanDownToClose={!pending}
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
              {marketName} {t('page.perps.pro.trade.marginMode')}
            </Text>
            <View style={styles.options}>
              {options.map(option => {
                const active = option.value === selected;
                const disabled =
                  pending || disabledValues.includes(option.value);
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active, disabled }}
                    disabled={disabled}
                    key={option.value}
                    onPress={async () => {
                      if (await onSelect(option.value)) {
                        onClose();
                      }
                    }}
                    style={[
                      styles.option,
                      active ? styles.optionActive : styles.optionInactive,
                      disabled ? styles.disabled : null,
                    ]}
                    testID={`perps-pro-margin-mode-${option.value}`}>
                    <View
                      style={styles.copy}
                      testID={`perps-pro-margin-mode-${option.value}-copy`}>
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

PerpsProMarginModeSheet.displayName = 'PerpsProMarginModeSheet';

const getStyle = createGetStyles2024(({ colors2024, safeAreaInsets }) => ({
  ...getPerpsProDialogStyles(colors2024, safeAreaInsets.bottom),
  disabled: { opacity: 0.45 },
}));

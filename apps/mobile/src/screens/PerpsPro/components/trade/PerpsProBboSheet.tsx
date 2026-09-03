import RcOptionCheck from '@/assets2024/icons/perps/PerpsProOptionCheck.svg';
import { AppBottomSheetModal } from '@/components';
import { Text } from '@/components/Typography';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';

import type { PerpsProBboStrategy } from '../../model/bbo';
import { getPerpsProBottomSheetChromeStyles } from '../common/perpsProVisual';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';

export interface PerpsProBboOption {
  label: string;
  value: PerpsProBboStrategy;
}

export const PerpsProBboSheet: React.FC<{
  onClose: () => void;
  onSelect: (value: PerpsProBboStrategy) => void;
  options: readonly PerpsProBboOption[];
  selected: PerpsProBboStrategy | null;
  visible: boolean;
}> = React.memo(({ onClose, onSelect, options, selected, visible }) => {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { colors2024, styles } = useTheme2024({ getStyle });
  usePerpsProSheetNavigationRegistration({
    active: visible,
    dismiss: onClose,
  });

  useEffect(() => {
    if (visible) modalRef.current?.present();
    else modalRef.current?.close();
  }, [visible]);

  return (
    <AppBottomSheetModal
      onDismiss={onClose}
      ref={modalRef}
      snapPoints={[316]}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg1',
      })}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handleIndicator}
      handleStyle={styles.handle}
      style={styles.modal}>
      <BottomSheetView style={styles.sheet}>
        <View style={styles.content}>
          <Text style={styles.title}>BBO</Text>
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
                  style={styles.option}
                  testID={`perps-pro-bbo-${option.value}`}>
                  <Text style={styles.label}>{option.label}</Text>
                  {active ? (
                    <RcOptionCheck
                      color={colors2024['green-default']}
                      height={24}
                      testID="perps-pro-bbo-selected"
                      width={24}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
});

PerpsProBboSheet.displayName = 'PerpsProBboSheet';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  ...getPerpsProBottomSheetChromeStyles(colors2024),
  sheet: { height: '100%' },
  content: {
    height: '100%',
    paddingHorizontal: 15,
    paddingTop: 8,
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  options: { gap: 8, marginTop: 16 },
  option: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    paddingVertical: 8,
  },
  label: {
    color: colors2024['neutral-title-1'],
    flex: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
}));

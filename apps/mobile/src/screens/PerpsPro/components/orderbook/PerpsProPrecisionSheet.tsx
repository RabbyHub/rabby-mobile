import RcOptionCheck from '@/assets2024/icons/perps/PerpsProOptionCheck.svg';
import { AppBottomSheetModal } from '@/components';
import { Text } from '@/components/Typography';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, useWindowDimensions, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getPerpsProPrecisionSheetLayout } from '../../model/layout';
import type { PerpsTickOption } from '../../model/orderBook';
import { formatPerpsProPrice } from '../../utils/format';
import { getPerpsProBottomSheetChromeStyles } from '../common/perpsProVisual';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';

export const PerpsProPrecisionSheet: React.FC<{
  onClose: () => void;
  onIntentStart?: (option: PerpsTickOption) => void;
  onSelect: (option: PerpsTickOption) => void;
  options: PerpsTickOption[];
  selected: PerpsTickOption | null;
}> = ({ onClose, onIntentStart, onSelect, options, selected }) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const modalRef = useRef<AppBottomSheetModal>(null);
  const sheetLayout = getPerpsProPrecisionSheetLayout({
    bottomInset: insets.bottom,
    optionCount: options.length,
    topInset: insets.top,
    windowHeight: height,
  });
  const contentContainerStyle = useMemo<ViewStyle>(
    () => ({ paddingBottom: sheetLayout.bottomPadding }),
    [sheetLayout.bottomPadding],
  );
  usePerpsProSheetNavigationRegistration({ active: true, dismiss: onClose });

  useEffect(() => {
    modalRef.current?.present();
  }, []);

  return (
    <AppBottomSheetModal
      enableDynamicSizing={false}
      onDismiss={onClose}
      ref={modalRef}
      snapPoints={[sheetLayout.snapPoint]}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg1',
      })}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handleIndicator}
      handleStyle={styles.handle}
      style={styles.modal}>
      <BottomSheetScrollView
        contentContainerStyle={[styles.sheetContent, contentContainerStyle]}
        scrollEnabled={sheetLayout.scrollEnabled}
        showsVerticalScrollIndicator={false}
        testID="perps-pro-precision-options">
        {options.map(option => {
          const active =
            option.nSigFigs === selected?.nSigFigs &&
            option.mantissa === selected.mantissa;
          return (
            <Pressable
              key={`${option.nSigFigs}:${option.mantissa ?? 'null'}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => {
                onSelect(option);
                onClose();
              }}
              onPressIn={() => onIntentStart?.(option)}
              style={styles.option}
              testID={`perps-pro-precision-${option.nSigFigs}-${
                option.mantissa ?? 'null'
              }`}>
              <Text style={styles.optionText}>
                {formatPerpsProPrice(option.displayPrice, option.priceDecimals)}
              </Text>
              {active ? (
                <RcOptionCheck
                  color={colors2024['green-default']}
                  height={24}
                  testID="perps-pro-precision-selected"
                  width={24}
                />
              ) : null}
            </Pressable>
          );
        })}
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  ...getPerpsProBottomSheetChromeStyles(colors2024),
  sheetContent: {
    gap: 8,
    paddingHorizontal: 15,
    paddingTop: 8,
  },
  option: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 12,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 40,
    overflow: 'hidden',
    paddingVertical: 8,
  },
  optionText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
}));

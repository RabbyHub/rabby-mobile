import { AppBottomSheetModal } from '@/components';
import { Text } from '@/components/Typography';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, useWindowDimensions, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getPerpsProPrecisionSheetLayout } from '../../model/layout';
import type { PerpsTickOption } from '../../model/orderBook';
import { formatPerpsProPrice } from '../../utils/format';

export const PerpsProPrecisionSheet: React.FC<{
  onClose: () => void;
  onSelect: (option: PerpsTickOption) => void;
  options: PerpsTickOption[];
  selected: PerpsTickOption | null;
}> = ({ onClose, onSelect, options, selected }) => {
  const { colors2024, isLight, styles } = useTheme2024({ getStyle });
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { t } = useTranslation();
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
        linearGradientType: isLight ? 'bg0' : 'bg1',
      })}>
      <BottomSheetScrollView
        contentContainerStyle={[styles.sheetContent, contentContainerStyle]}
        scrollEnabled={sheetLayout.scrollEnabled}
        showsVerticalScrollIndicator={sheetLayout.scrollEnabled}>
        <Text style={styles.title}>
          {t('page.perps.pro.orderBook.priceAggregation')}
        </Text>
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
              style={styles.option}>
              <Text style={styles.optionText}>
                {formatPerpsProPrice(option.displayPrice, option.priceDecimals)}
              </Text>
              {active ? <Text style={styles.check}>✓</Text> : null}
            </Pressable>
          );
        })}
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 10,
    textAlign: 'center',
  },
  option: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 44,
    justifyContent: 'space-between',
  },
  optionText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  check: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
}));

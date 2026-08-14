import RcOptionCheck from '@/assets2024/icons/perps/PerpsProOptionCheck.svg';
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
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';

export const PerpsProTpSlModeSheet: React.FC<{
  onClose: () => void;
  onSelect: (mode: PerpsProTpSlMode) => void;
  selected: PerpsProTpSlMode;
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

  return (
    <AppBottomSheetModal
      onDismiss={onClose}
      ref={modalRef}
      snapPoints={[324]}
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
                    <Text style={styles.description}>{option.description}</Text>
                  </View>
                  {active ? (
                    <View style={styles.check}>
                      <RcOptionCheck
                        color={colors2024['green-default']}
                        height={26}
                        testID="perps-pro-tpsl-mode-selected"
                        width={26}
                      />
                    </View>
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

PerpsProTpSlModeSheet.displayName = 'PerpsProTpSlModeSheet';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  modal: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  background: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  handle: {
    backgroundColor: colors2024['neutral-bg-1'],
    height: 40,
    paddingBottom: 19,
    paddingTop: 17,
  },
  handleIndicator: {
    backgroundColor: colors2024['neutral-line'],
    borderRadius: 2,
    height: 4,
    width: 40,
  },
  sheet: { height: '100%' },
  content: {
    height: '100%',
    paddingHorizontal: 15,
    paddingTop: 8,
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  options: { gap: 8, marginTop: 16 },
  option: {
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionActive: {
    backgroundColor: colors2024['brand-light-1'],
    borderColor: colors2024['brand-default'],
  },
  optionInactive: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderColor: colors2024['neutral-info'],
  },
  copy: { flex: 1, gap: 4, minWidth: 0 },
  label: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  description: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
  check: {
    alignItems: 'center',
    height: 26,
    justifyContent: 'center',
    marginLeft: 8,
    width: 26,
  },
}));

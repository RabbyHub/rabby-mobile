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

import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';

type MarginMode = 'cross' | 'isolated';

export const PerpsProMarginModeSheet: React.FC<{
  disabledValues?: readonly MarginMode[];
  marketName: string;
  onClose: () => void;
  onSelect: (value: MarginMode) => void;
  selected: MarginMode;
  visible: boolean;
}> = React.memo(
  ({
    disabledValues = [],
    marketName,
    onClose,
    onSelect,
    selected,
    visible,
  }) => {
    const modalRef = useRef<AppBottomSheetModal>(null);
    const { colors2024, isLight, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    usePerpsProSheetNavigationRegistration({
      active: visible,
      dismiss: onClose,
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
        onDismiss={onClose}
        ref={modalRef}
        snapPoints={[372]}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: isLight ? 'bg0' : 'bg1',
        })}>
        <BottomSheetView style={styles.sheet}>
          <View style={styles.content}>
            <Text style={styles.title}>
              {marketName} {t('page.perps.pro.trade.marginMode')}
            </Text>
            <View style={styles.options}>
              {options.map(option => {
                const active = option.value === selected;
                const disabled = disabledValues.includes(option.value);
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active, disabled }}
                    disabled={disabled}
                    key={option.value}
                    onPress={() => {
                      onSelect(option.value);
                      onClose();
                    }}
                    style={[
                      styles.option,
                      active ? styles.optionActive : styles.optionInactive,
                      disabled ? styles.disabled : null,
                    ]}
                    testID={`perps-pro-margin-mode-${option.value}`}>
                    <View style={styles.copy}>
                      <Text style={styles.label}>{option.label}</Text>
                      <Text style={styles.description}>
                        {option.description}
                      </Text>
                    </View>
                    {active ? (
                      <View style={styles.check}>
                        <RcOptionCheck
                          color={colors2024['green-default']}
                          height={24}
                          testID="perps-pro-margin-mode-selected"
                          width={24}
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
  },
);

PerpsProMarginModeSheet.displayName = 'PerpsProMarginModeSheet';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
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
  disabled: { opacity: 0.45 },
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

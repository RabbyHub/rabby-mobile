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

import type { PerpsProTradeOrderType } from '../../model/trade';
import { getPerpsProBottomSheetChromeStyles } from '../common/perpsProVisual';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';
import { PerpsProOrderTypeIcon } from './PerpsProOrderTypeIcon';

export const PerpsProOrderTypeSheet: React.FC<{
  onClose: () => void;
  onSelect: (value: PerpsProTradeOrderType) => void;
  selected: PerpsProTradeOrderType;
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
    value: PerpsProTradeOrderType;
  }> = [
    {
      description: t('page.perps.pro.trade.limitDescription'),
      label: t('page.perps.pro.trade.limit'),
      value: 'limit',
    },
    {
      description: t('page.perps.pro.trade.marketDescription'),
      label: t('page.perps.pro.trade.market'),
      value: 'market',
    },
    {
      description: t('page.perps.pro.trade.conditionalDescription'),
      label: t('page.perps.pro.trade.conditional'),
      value: 'conditional',
    },
  ];

  return (
    <AppBottomSheetModal
      onDismiss={onClose}
      ref={modalRef}
      snapPoints={[326]}
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
            {t('page.perps.pro.trade.orderType')}
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
                  style={styles.option}
                  testID={`perps-pro-order-type-${option.value}`}>
                  <PerpsProOrderTypeIcon
                    backgroundColor={colors2024['neutral-bg-1']}
                    footColor={colors2024['neutral-foot']}
                    titleColor={colors2024['neutral-title-1']}
                    type={option.value}
                  />
                  <View style={styles.copy}>
                    <Text style={styles.label}>{option.label}</Text>
                    <Text style={styles.description}>{option.description}</Text>
                  </View>
                  {active ? (
                    <RcOptionCheck
                      color={colors2024['green-default']}
                      height={24}
                      testID="perps-pro-order-type-selected"
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

PerpsProOrderTypeSheet.displayName = 'PerpsProOrderTypeSheet';

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
    fontFamily: 'SF Pro',
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
    gap: 12,
    overflow: 'hidden',
    paddingVertical: 8,
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
}));

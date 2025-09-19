import BigNumber from 'bignumber.js';
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { GasLevel } from '@rabby-wallet/rabby-api/dist/types';
import { getGasLevelI18nKey } from '@/utils/trans';
import {
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TextInputChangeEventData,
  TextInputSubmitEditingEventData,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { TextInput } from 'react-native-gesture-handler';
import { Skeleton } from '@rneui/themed';
import { calcGasEstimated } from '@/utils/time';
import { createGetStyles2024 } from '@/utils/styles';

export interface GasSelectorResponse extends GasLevel {
  gasLimit: number;
  nonce: number;
  maxPriorityFee: number;
}

const getStyles = createGetStyles2024(({ colors, colors2024 }) => ({
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  card: {
    flex: 1,
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 8,
    borderColor: 'transparent',
    borderWidth: 1,
    paddingTop: 14,
    paddingBottom: 12,
  },
  cardActive: {
    backgroundColor: colors2024['brand-light-1'],
    borderColor: colors['blue-default'],
    shadowColor: 'transparent',
  },
  cardItem: {},
  cardItemTitle: {
    color: colors2024['neutral-secondary'],
    fontSize: 12,
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    lineHeight: 14,
    fontWeight: '500',
  },
  cardItemText: {
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    margin: 0,
    height: 16,
    lineHeight: 16,
    padding: 0,
    marginTop: 4,
  },
  cardItemTextActive: {
    // color: colors['blue-default'],
  },
  cardBodyDisabled: {},
  cardTime: {
    marginTop: 2,
  },
  cardTimeText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
    marginTop: 0,
  },
  cardTimeLoader: {
    marginTop: 2,
    alignItems: 'center',
  },
}));

export const GasSelectContainer = ({
  gasList,
  selectedGas,
  panelSelection,
  customGas,
  customGasConfirm = () => null,
  handleCustomGasChange,
  disabled,
  isSelectCustom,
  notSelectCustomGasAndIsNil,
  isLoadingGas,
  customGasEstimated,
}: {
  gasList: GasLevel[];
  selectedGas: GasLevel | null;
  panelSelection: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    item: GasLevel,
  ) => void;
  customGas: string | number | undefined;
  customGasConfirm?: (
    e: NativeSyntheticEvent<TextInputSubmitEditingEventData>,
  ) => void;
  handleCustomGasChange: (
    e: NativeSyntheticEvent<TextInputChangeEventData>,
  ) => void;
  disabled?: boolean;
  isSelectCustom?: boolean;
  notSelectCustomGasAndIsNil?: boolean;
  isLoadingGas?: boolean;
  customGasEstimated?: number;
}) => {
  const { styles } = useTheme2024({
    getStyle: getStyles,
  });
  const { t } = useTranslation();
  const customerInputRef = useRef<TextInput>(null);
  const handlePanelSelection = (e, item) => {
    if (disabled) return;
    return panelSelection(e, item);
  };

  return (
    <View
      style={StyleSheet.flatten([
        styles.cardBody,
        disabled && styles.cardBodyDisabled,
      ])}>
      {gasList.map((item, idx) => (
        <TouchableOpacity
          key={`gas-item-${item.level}-${idx}`}
          style={StyleSheet.flatten([
            styles.card,
            (isSelectCustom
              ? item.level === 'custom'
              : selectedGas?.level === item.level) && styles.cardActive,
          ])}
          onPress={e => {
            handlePanelSelection(e, item);
            if (item.level === 'custom') {
              customerInputRef.current?.focus();
            } else {
              customerInputRef.current?.blur();
            }
          }}>
          <Text style={[styles.cardItem, styles.cardItemTitle]}>
            {t(getGasLevelI18nKey(item.level))}
          </Text>
          <View style={styles.cardItem}>
            {item.level === 'custom' ? (
              notSelectCustomGasAndIsNil ? (
                <Text
                  style={StyleSheet.flatten({
                    textAlign: 'center',
                  })}>
                  -
                </Text>
              ) : (
                <BottomSheetTextInput
                  keyboardType="numeric"
                  style={StyleSheet.flatten([
                    styles.cardItemText,
                    selectedGas?.level === item.level &&
                      styles.cardItemTextActive,
                  ])}
                  defaultValue={customGas ? customGas.toString() : ''}
                  onChange={handleCustomGasChange}
                  // onSubmitEditing={customGasConfirm}
                  onFocus={e => handlePanelSelection(e, item)}
                  ref={customerInputRef}
                  // autoFocus={selectedGas?.level === item.level}
                  // disabled={disabled}
                  placeholder="0"
                  selectTextOnFocus
                />
              )
            ) : (
              <Text
                style={StyleSheet.flatten([
                  styles.cardItemText,
                  selectedGas?.level === item.level &&
                    styles.cardItemTextActive,
                ])}>
                {new BigNumber(item.price / 1e9).toFixed()}
              </Text>
            )}

            <View style={styles.cardTime}>
              {item.level === 'custom' ? (
                notSelectCustomGasAndIsNil ? null : isLoadingGas ? (
                  <View style={styles.cardTimeLoader}>
                    <Skeleton width={44} height={12} />
                  </View>
                ) : (
                  <Text style={styles.cardTimeText}>
                    {calcGasEstimated(customGasEstimated)}
                  </Text>
                )
              ) : (
                <Text style={styles.cardTimeText}>
                  {calcGasEstimated(item.estimated_seconds)}
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
};

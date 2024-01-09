import BigNumber from 'bignumber.js';
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { GasLevel } from '@rabby-wallet/rabby-api/dist/types';
import { getGasLevelI18nKey } from '@/utils/trans';
import {
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TextInput,
  TextInputChangeEventData,
  TextInputSubmitEditingEventData,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';

export interface GasSelectorResponse extends GasLevel {
  gasLimit: number;
  nonce: number;
  maxPriorityFee: number;
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    cardBody: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    },
    card: {
      width: 76,
      height: 52,
      backgroundColor: colors['neutral-card-3'],
      borderRadius: 4,
      borderColor: 'transparent',
    },
    cardActive: {
      backgroundColor: colors['blue-light-1'],
      borderColor: colors['blue-default'],
    },
    cardItem: {
      marginTop: 4,
    },
    cardItemText: {
      color: colors['neutral-title-1'],
      textAlign: 'center',
      padding: 0,
      fontSize: 13,
      fontWeight: '500',
      margin: 0,
      height: 18,
    },
    cardItemTextActive: {
      color: colors['blue-default'],
    },
    cardBodyDisabled: {},
  });

export const GasSelectContainer = ({
  gasList,
  selectedGas,
  panelSelection,
  customGas,
  customGasConfirm = () => null,
  handleCustomGasChange,
  disabled,
}: {
  gasList: GasLevel[];
  selectedGas: GasLevel | null;
  panelSelection: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    item: GasLevel,
  ) => void;
  customGas: string | number;
  customGasConfirm?: (
    e: NativeSyntheticEvent<TextInputSubmitEditingEventData>,
  ) => void;
  handleCustomGasChange: (
    e: NativeSyntheticEvent<TextInputChangeEventData>,
  ) => void;
  disabled?: boolean;
}) => {
  const colors = useThemeColors();
  const styles = getStyles(colors);
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
            selectedGas?.level === item.level && styles.cardActive,
          ])}
          onPress={e => {
            handlePanelSelection(e, item);
            if (item.level === 'custom') {
              customerInputRef.current?.focus();
            } else {
              customerInputRef.current?.blur();
            }
          }}>
          <Text style={[styles.cardItem, styles.cardItemText]}>
            {t(getGasLevelI18nKey(item.level))}
          </Text>
          <View style={styles.cardItem}>
            {item.level === 'custom' ? (
              <TextInput
                keyboardType="number-pad"
                style={StyleSheet.flatten([
                  styles.cardItemText,
                  selectedGas?.level === item.level &&
                    styles.cardItemTextActive,
                ])}
                defaultValue={customGas.toString()}
                onChange={handleCustomGasChange}
                // onSubmitEditing={customGasConfirm}
                onFocus={e => handlePanelSelection(e, item)}
                ref={customerInputRef}
                autoFocus={selectedGas?.level === item.level}
                // disabled={disabled}
                placeholder="0"
              />
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
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
};

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Text,
  TextInputProps,
  TextInput,
  View,
  GestureResponderEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { BigNumber } from 'bignumber.js';
import { BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { Chain } from '@/constant/chains';
import { GasLevel, TokenItem } from '@rabby-wallet/rabby-api/dist/types';

import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import { findChainByID } from '@/utils/chain';
import { MINIMUM_GAS_LIMIT } from '@/constant/gas';
import { formatTokenAmount } from '@/utils/number';
import { getGasLevelI18nKey } from '@/utils/trans';
import { AppBottomSheetModal, Button } from '@/components';
import TouchableView from '@/components/Touchable/TouchableView';
import { coerceNumber } from '@/utils/coerce';
import AutoLockView from '@/components/AutoLockView';

interface GasSelectorProps {
  chainId: Chain['id'];
  onChange(gas: GasLevel): void;
  gasList: GasLevel[];
  gas: GasLevel | null;
  visible: boolean;
  token: TokenItem;
  onClose(): void;
}

export default function GasSelectorBottomSheetModal({
  chainId,
  onChange,
  gasList,
  gas,
  visible,
  token,
  onClose,
}: GasSelectorProps) {
  const { t } = useTranslation();

  const { styles } = useThemeStyles(getStyles);

  const customerInputRef = useRef<TextInput>(null);
  const [customGas, setCustomGas] = useState<string | number>('1');
  const [selectedGas, setSelectedGas] = useState(gas);
  const chain = findChainByID(chainId);

  const handleConfirmGas = useCallback(() => {
    if (!selectedGas) return;
    if (selectedGas.level === 'custom') {
      onChange({
        ...selectedGas,
        price: Number(customGas) * 1e9,
        level: selectedGas.level,
      });
    } else {
      onChange({
        ...selectedGas,
        level: selectedGas.level,
      });
    }
  }, [selectedGas, onChange, customGas]);

  const handleCustomGasChange = useCallback<
    TextInputProps['onChange'] & object
  >(e => {
    e.stopPropagation();
    if (/^\d*(\.\d*)?$/.test(e.nativeEvent.text)) {
      setCustomGas(e.nativeEvent.text);
    }
  }, []);

  const panelSelection = useCallback(
    (e: GestureResponderEvent | undefined, gas: GasLevel) => {
      e?.stopPropagation();
      const target = gas;

      if (gas.level === selectedGas?.level) return;
      if (gas.level === 'custom') {
        setSelectedGas({
          ...target,
          level: 'custom',
        });
        customerInputRef.current?.focus();
      } else {
        setSelectedGas({
          ...gas,
          level: gas?.level,
        });
      }
    },
    [selectedGas?.level],
  );

  // const customGasConfirm = useCallback<TextInputProps['onKeyPress'] & object>(
  //   e => {
  //     if (e.nativeEvent.key !== '13') return;

  //     const gas = {
  //       level: 'custom',
  //       price: Number(customGas),
  //       front_tx_count: 0,
  //       estimated_seconds: 0,
  //       base_fee: gasList[0].base_fee,
  //       priority_price: null,
  //     };
  //     setSelectedGas({
  //       ...gas,
  //       price: Number(gas.price),
  //       level: gas.level,
  //     });
  //   },
  //   [customGas, gasList],
  // );

  useEffect(() => {
    if (selectedGas?.level === 'custom') {
      setSelectedGas({
        level: 'custom',
        price: Number(customGas) * 1e9,
        front_tx_count: 0,
        estimated_seconds: 0,
        base_fee: 0,
        priority_price: null,
      });
    }
  }, [customGas, selectedGas?.level]);

  useEffect(() => {
    setSelectedGas(gas);
  }, [gas]);

  const modalRef = React.useRef<AppBottomSheetModal>(null);
  React.useEffect(() => {
    if (!visible) {
      modalRef.current?.close();
    } else {
      modalRef.current?.present();
    }
  }, [visible]);

  return (
    <AppBottomSheetModal
      index={0}
      ref={modalRef}
      snapPoints={['50%']}
      keyboardBlurBehavior="restore"
      onDismiss={onClose}>
      <AutoLockView as="BottomSheetView" style={styles.container}>
        <View style={styles.topArea}>
          <Text style={styles.title}>Set Gas Price (Gwei)</Text>
          <View style={styles.description}>
            <Text style={styles.descriptionText}>
              {/* The gas cost will be reserved from the transfer amount based on the gas
            price you set */}
              {t('page.sendToken.GasSelector.popupDesc')}
            </Text>
          </View>
          <View style={styles.gasSelector}>
            <View style={styles.gasSelectorTop}>
              <Text style={styles.usmoney}>
                ≈ $
                {new BigNumber(selectedGas ? selectedGas.price : 0)
                  .times(MINIMUM_GAS_LIMIT)
                  .div(1e18)
                  .times(token.price)
                  .toFixed(2)}
              </Text>
              <Text style={styles.gasmoney}>
                {`${formatTokenAmount(
                  new BigNumber(selectedGas ? selectedGas.price : 0)
                    .times(MINIMUM_GAS_LIMIT)
                    .div(1e18)
                    .toFixed(),
                )} ${chain?.nativeTokenSymbol || ''}`}
              </Text>
            </View>
            <View style={styles.selectionContainer}>
              {gasList.map(item => (
                <TouchableView
                  key={`${item.base_fee}-${item.level}`}
                  style={[
                    styles.selectionItem,
                    selectedGas?.level === item.level && styles.activeCard,
                  ]}
                  onPress={(e?: GestureResponderEvent) => {
                    panelSelection(e, item);
                  }}>
                  <Text style={styles.gasLevel}>
                    {t(getGasLevelI18nKey(item.level))}
                  </Text>
                  <View style={styles.selectionText}>
                    {item.level === 'custom' ? (
                      <TouchableView
                        style={[styles.cardCustomInputContainer]}
                        onPress={(e?: GestureResponderEvent) =>
                          panelSelection(e, item)
                        }>
                        <BottomSheetTextInput
                          style={[
                            item.level === 'custom' && styles.cardCustomInput,
                          ]}
                          value={customGas + ''}
                          defaultValue={customGas + ''}
                          onChange={handleCustomGasChange}
                          keyboardType="number-pad"
                          // onKeyPress={customGasConfirm}
                          ref={customerInputRef as any}
                          autoFocus={selectedGas?.level === item.level}
                        />
                      </TouchableView>
                    ) : (
                      <Text
                        style={[
                          styles.selectionTitle,
                          selectedGas?.level === item.level &&
                            styles.activeCardTitle,
                        ]}>
                        {item.price / 1e9}
                      </Text>
                    )}
                  </View>
                </TouchableView>
              ))}
            </View>
          </View>
        </View>
        <View style={styles.footer}>
          <Button
            type="primary"
            style={styles.footerButton}
            onPress={handleConfirmGas}
            // Confirm
            title={t('page.sendToken.GasSelector.confirm')}
          />
        </View>
      </AutoLockView>
    </AppBottomSheetModal>
  );
}

const SELECTION_H = 48;

const getStyles = createGetStyles(colors => {
  return {
    container: {
      padding: 20,
      flexDirection: 'column',
      alignItems: 'stretch',
      justifyContent: 'space-between',
      height: '100%',
      // ...makeDebugBorder()
    },
    topArea: {},
    title: {
      fontWeight: '500',
      fontSize: 20,
      lineHeight: 23,
      textAlign: 'center',
      color: colors['neutral-title-1'],
    },
    description: {
      marginTop: 20,
      marginBottom: 20,
    },
    descriptionText: {
      fontWeight: '400',
      fontSize: 13,
      lineHeight: 16,
      textAlign: 'center',
      // color: var(--r-neutral-foot, #babec5);
      color: colors['neutral-foot'],
    },
    gasSelector: {
      backgroundColor: colors['neutral-card2'],
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors['neutral-line'],
      borderRadius: 6,
      display: 'flex',
      marginBottom: 20,
      padding: 16,
      flexDirection: 'column',
    },
    gasSelectorTop: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      position: 'relative',
      width: '100%',
      height: 18,
      lineHeight: 18,
    },
    usmoney: {
      color: colors['neutral-title-1'],
      fontSize: 15,
      lineHeight: 18,
      fontWeight: '500',
    },
    gasmoney: {
      color: colors['neutral-title-1'],
      fontSize: 12,
      marginLeft: 8,
    },

    selectionContainer: {
      height: 48,
      marginTop: 12,
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      gap: 2,
    },

    selectionItem: {
      backgroundColor: colors['neutral-card1'],
      // width: 76,
      width: '100%',
      height: SELECTION_H,
      flexShrink: 1,
      borderRadius: 4,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      marginVertical: 0,
      marginHorizontal: 4,
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: 'transparent',
    },
    activeCard: {
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors['blue-default'],
    },

    gasLevel: {
      textAlign: 'center',
      fontSize: 12,
      lineHeight: 14,
      marginTop: 8,
      marginHorizontal: 'auto',
      marginBottom: 0,
      color: colors['neutral-body'],
    },

    selectionText: {
      paddingVertical: 0,
      paddingTop: 4,
      height: 24,
    },
    selectionTitle: {
      textAlign: 'center',
      lineHeight: 14,
      marginTop: 2,
      marginHorizontal: 'auto',
      marginBottom: 0,
      color: colors['neutral-title-1'],
      fontSize: 13,
      fontWeight: '500',
      height: '100%',
    },
    cardCustomInputContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      // backgroundColor: colors['neutral-card2'],
      backgroundColor: 'transparent',
      width: '100%',
      height: '100%',
    },
    cardCustomInput: {
      color: colors['neutral-title-1'],
      textAlign: 'center',
      fontSize: 12,
      fontWeight: '500',
      paddingVertical: 0,
      // ...makeDebugBorder(),
    },
    activeCardTitle: {},

    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      // ...makeDebugBorder()
    },
    footerButton: { width: 200 },
  };
});

import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { BottomSheetView, TouchableOpacity } from '@gorhom/bottom-sheet';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { AppBottomSheetModalTitle } from '../customized/BottomSheet';
import { FooterButton } from '../FooterButton/FooterButton';
import AutoLockView from '../AutoLockView';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    root: {
      height: '100%',
      position: 'relative',
    },
    main: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    text: {
      fontSize: 16,
      color: colors['neutral-body'],
      lineHeight: 20,
    },
    keyboard: {
      flex: 1,
    },
    keyboardRow: {
      flex: 1,
      flexDirection: 'row',
    },
    pinItem: {
      flex: 1,
      height: 64,
      justifyContent: 'center',
      alignItems: 'center',
    },
    inputBox: {
      paddingVertical: 18,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderRadius: 8,
      borderColor: colors['neutral-line'],
      marginBottom: 16,
      height: 52,
      marginTop: 20,
      flexDirection: 'row',
      columnGap: 10,
      overflow: 'hidden',
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors['neutral-title-1'],
    },
    keyboardView: {
      width: '100%',
      flex: 1,
    },
    onDevice: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
    },
  });

const PinItem = ({
  onInput,
  value,
}: {
  onInput: (value: string) => void;
  value: string;
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  return (
    <TouchableOpacity style={styles.pinItem} onPress={() => onInput(value)}>
      <View style={styles.dot} />
    </TouchableOpacity>
  );
};

export const OneKeyInputPin = ({
  onConfirm,
}: {
  onConfirm: (pin: string, switchOnDevice: boolean) => void;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [pin, setPin] = React.useState('');
  const [isOnDevice, setIsOnDevice] = React.useState(false);

  const handleOnConfirm = () => {
    onConfirm(pin, false);
  };

  const handleOnDevice = () => {
    onConfirm('', true);
    setIsOnDevice(true);
  };

  const handleOnInput = (value: string) => {
    setPin(prev => prev + value);
  };

  if (isOnDevice) {
    return (
      <BottomSheetView style={styles.root}>
        <AppBottomSheetModalTitle
          title={t('page.newAddress.onekey.inputPin.title')}
        />
        <View style={styles.main}>
          <Text style={styles.text}>
            {t('page.newAddress.onekey.inputPin.onDevice')}
          </Text>
        </View>
      </BottomSheetView>
    );
  }

  return (
    <AutoLockView as="BottomSheetView" style={styles.root}>
      <AppBottomSheetModalTitle
        title={t('page.newAddress.onekey.inputPin.title')}
      />

      <View style={styles.main}>
        <Text style={styles.text}>
          {t('page.newAddress.onekey.inputPin.description')}
        </Text>
        <View style={styles.keyboardView}>
          <View style={styles.inputBox}>
            {pin.split('').map((_, index) => (
              <View key={index} style={styles.dot} />
            ))}
          </View>

          <View style={styles.keyboard}>
            <View style={styles.keyboardRow}>
              <PinItem onInput={handleOnInput} value="7" />
              <PinItem onInput={handleOnInput} value="8" />
              <PinItem onInput={handleOnInput} value="9" />
            </View>
            <View style={styles.keyboardRow}>
              <PinItem onInput={handleOnInput} value="4" />
              <PinItem onInput={handleOnInput} value="5" />
              <PinItem onInput={handleOnInput} value="6" />
            </View>
            <View style={styles.keyboardRow}>
              <PinItem onInput={handleOnInput} value="1" />
              <PinItem onInput={handleOnInput} value="2" />
              <PinItem onInput={handleOnInput} value="3" />
            </View>
          </View>
        </View>
      </View>
      <FooterButton
        type="primary"
        onPress={handleOnConfirm}
        title={t('global.next')}>
        <TouchableOpacity style={styles.onDevice} onPress={handleOnDevice}>
          <Text>{t('page.newAddress.onekey.inputPin.onDevice')}</Text>
        </TouchableOpacity>
      </FooterButton>
    </AutoLockView>
  );
};

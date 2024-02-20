import { AppColorsVariants } from '@/constant/theme';
import { LEDGER_ERROR_CODES } from '@/hooks/ledger/error';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Device } from 'react-native-ble-plx';
import { AppBottomSheetModalTitle } from '../customized/BottomSheet';
import { Text } from '../Text';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    root: {
      height: '100%',
      position: 'relative',
    },
    main: {
      flex: 1,
      paddingHorizontal: 20,
    },
    item: {
      padding: 15,
      backgroundColor: colors['neutral-card-2'],
      borderRadius: 8,
    },
  });

export const SelectDeviceScreen: React.FC<{
  onSelect: (d: Device) => void;
  devices: Device[];
  errorCode?: LEDGER_ERROR_CODES;
}> = ({ onSelect, devices, errorCode }) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.root}>
      <AppBottomSheetModalTitle title={t('查找到以下设备')} />
      <View style={styles.main}>
        {devices.map((device, index) => (
          <TouchableOpacity
            key={device.id}
            onPress={() => {
              onSelect(device);
            }}
            style={styles.item}>
            <Text key={index}>{device.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

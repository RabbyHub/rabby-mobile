import { AppColorsVariants } from '@/constant/theme';
import { LEDGER_ERROR_CODES } from '@/hooks/ledger/error';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Device } from 'react-native-ble-plx';
import { AppBottomSheetModalTitle } from '../customized/BottomSheet';
import { Text } from '../Text';
import LedgerSVG from '@/assets/icons/wallet/ledger.svg';
import { RcIconRightCC } from '@/assets/icons/common';
import { toast } from '../Toast';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    root: {
      height: '100%',
      position: 'relative',
    },
    main: {
      flex: 1,
      paddingHorizontal: 20,
      alignItems: 'center',
    },
    text: {
      fontSize: 16,
      color: colors['neutral-body'],
      lineHeight: 20,
    },
    item: {
      paddingHorizontal: 15,
      paddingVertical: 20,
      backgroundColor: colors['neutral-card-2'],
      borderRadius: 8,
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    list: {
      marginTop: 24,
      width: '100%',
      rowGap: 12,
    },
    textWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: 12,
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
  const [locked, setLocked] = React.useState(false);

  const handlePress = React.useCallback(
    async device => {
      const toastHidden = toast.show('Connecting...', {
        duration: 100000,
      });
      setLocked(true);
      await onSelect(device);
      toastHidden();
    },
    [onSelect],
  );

  return (
    <View style={styles.root}>
      <AppBottomSheetModalTitle title={t('查找到以下设备')} />
      <View style={styles.main}>
        <Text style={styles.text}>请选择当前使用的Ledger</Text>
        <View style={styles.list}>
          {devices.map((device, index) => (
            <TouchableOpacity
              key={device.id}
              disabled={locked}
              onPress={() => handlePress(device)}
              style={styles.item}>
              <View style={styles.textWrapper}>
                <LedgerSVG width={28} height={28} />
                <Text key={index}>{device.name}</Text>
              </View>
              <RcIconRightCC />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
};

import { AppColorsVariants } from '@/constant/theme';
import { LEDGER_ERROR_CODES } from '@/hooks/ledger/error';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
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
      padding: 16,
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
    },
    listWrapper: {
      rowGap: 12,
    },
    textWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: 12,
    },
    itemText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors['neutral-title-1'],
    },
    currentDeviceTagText: {
      fontSize: 12,
      lineHeight: 14,
      color: colors['green-default'],
    },
    currentDeviceTag: {
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderWidth: 0.5,
      borderColor: colors['green-default'],
      borderRadius: 2,
      marginLeft: -4,
    },
  });

export const SelectDeviceScreen: React.FC<{
  onSelect: (d: Device) => void;
  devices: Device[];
  errorCode?: LEDGER_ERROR_CODES;
  currentDeviceId?: string;
}> = ({ onSelect, devices, currentDeviceId, errorCode }) => {
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
      setLocked(false);
      toastHidden();
    },
    [onSelect],
  );

  return (
    <View style={styles.root}>
      <AppBottomSheetModalTitle
        title={t('page.newAddress.ledger.select.title')}
      />
      <View style={styles.main}>
        <Text style={styles.text}>
          {t('page.newAddress.ledger.select.description')}
        </Text>
        <ScrollView style={styles.list}>
          <View style={styles.listWrapper}>
            {devices.map(device => (
              <TouchableOpacity
                key={device.id}
                disabled={locked}
                onPress={() => handlePress(device)}
                style={StyleSheet.flatten([
                  styles.item,
                  {
                    opacity: locked ? 0.6 : 1,
                  },
                ])}>
                <View style={styles.textWrapper}>
                  <LedgerSVG width={28} height={28} />
                  <Text style={styles.itemText}>{device.name}</Text>
                  {currentDeviceId === device.id && (
                    <View style={styles.currentDeviceTag}>
                      <Text style={styles.currentDeviceTagText}>
                        {t('page.newAddress.ledger.select.currentDevice')}
                      </Text>
                    </View>
                  )}
                </View>
                <RcIconRightCC
                  color={colors['neutral-foot']}
                  width={20}
                  height={20}
                />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

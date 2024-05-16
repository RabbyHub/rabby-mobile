import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppBottomSheetModalTitle } from '../customized/BottomSheet';
import { Text } from '../Text';
import { RcIconRightCC } from '@/assets/icons/common';
import { toastIndicator } from '../Toast';
import { SvgProps } from 'react-native-svg';

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
      textAlign: 'center',
      paddingHorizontal: 20,
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

type Device = {
  id: string | null;
  name: string | null;
};

export type Props = {
  onSelect: (d: Device) => void;
  devices: Device[];
  errorCode?: string | number;
  currentDeviceId?: string;
  titleText: string;
  descriptionText: string;
  currentDeviceText: string;
  DeviceLogo: React.FC<SvgProps>;
};

export const CommonSelectDeviceScreen: React.FC<Props> = ({
  onSelect,
  devices,
  currentDeviceId,
  errorCode,
  titleText,
  descriptionText,
  currentDeviceText,
  DeviceLogo,
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [locked, setLocked] = React.useState(false);
  let toastHiddenRef = React.useRef<() => void>(() => {});

  const handlePress = React.useCallback(
    async device => {
      toastHiddenRef.current = toastIndicator('Connecting', {
        isTop: true,
      });
      setLocked(true);
      try {
        await onSelect(device);
      } catch (e) {}
      setLocked(false);
      toastHiddenRef.current?.();
    },
    [onSelect],
  );

  React.useEffect(() => {
    devices.forEach(device => {
      if (device.id === currentDeviceId) {
        handlePress(device);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    return () => {
      toastHiddenRef.current?.();
    };
  }, []);

  return (
    <View style={styles.root}>
      <AppBottomSheetModalTitle title={titleText} />
      <View style={styles.main}>
        <Text style={styles.text}>{descriptionText}</Text>
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
                  <DeviceLogo width={28} height={28} />
                  <Text style={styles.itemText}>{device.name}</Text>
                  {currentDeviceId && currentDeviceId === device.id && (
                    <View style={styles.currentDeviceTag}>
                      <Text style={styles.currentDeviceTagText}>
                        {currentDeviceText}
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

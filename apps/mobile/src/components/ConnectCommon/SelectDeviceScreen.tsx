import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { AppBottomSheetModalTitle } from '../customized/BottomSheet';
import { Text } from '../Text';
import { toastIndicator } from '@/components2024/Toast';
import { SvgProps } from 'react-native-svg';
import { createGetStyles2024 } from '@/utils/styles';
import { ListItem } from '@/components2024/ListItem/ListItem';
import { Card } from '@/components2024/Card';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
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
    fontSize: 17,
    color: colors2024['neutral-secondary'],
    lineHeight: 22,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    paddingHorizontal: 24,
    textAlign: 'center',
  },
  item: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  list: {
    marginTop: 22,
    width: '100%',
  },
  listWrapper: {
    alignItems: 'stretch',
    padding: 0,
    paddingVertical: 12,
  },
  titleText: {
    fontSize: 20,
    color: colors2024['neutral-title-1'],
    lineHeight: 24,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
  },
}));

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
  DeviceLogo: React.ReactElement<any, any>;
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
  const { styles } = useTheme2024({ getStyle });
  const [locked, setLocked] = React.useState(false);
  let toastHiddenRef = React.useRef<() => void>(() => {});

  const handlePress = React.useCallback(
    async device => {
      toastHiddenRef.current = toastIndicator('Connecting');
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
      <AppBottomSheetModalTitle title={titleText} style={styles.titleText} />
      <View style={styles.main}>
        <Text style={styles.text}>{descriptionText}</Text>
        <ScrollView style={styles.list}>
          <Card style={styles.listWrapper}>
            {devices.map(device => (
              <ListItem
                key={device.id}
                style={styles.item}
                onPress={() => handlePress(device)}
                title={device.name || ''}
                Icon={DeviceLogo}
                disabled={locked}
              />
            ))}
          </Card>
        </ScrollView>
      </View>
    </View>
  );
};

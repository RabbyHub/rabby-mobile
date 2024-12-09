import React from 'react';
import { View } from 'react-native';
import { AppBottomSheetModalTitle } from '../customized/BottomSheet';
import { Text } from '../Text';
import { useTheme2024 } from '@/hooks/theme';
import { SvgProps } from 'react-native-svg';
import AutoLockView from '../AutoLockView';
import { MaterialIndicator } from 'react-native-indicators';
import { createGetStyles2024 } from '@/utils/styles';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
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
    fontSize: 17,
    color: colors2024['neutral-secondary'],
    lineHeight: 22,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
  },
  imageWrapper: {
    marginTop: 40,
    position: 'relative',
  },
  progress: {
    position: 'absolute',
    top: -15,
    left: -15,
  },
  titleText: {
    fontSize: 20,
    color: colors2024['neutral-title-1'],
    lineHeight: 24,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
  },
}));

type Props = {
  titleText: string;
  descriptionText: string;
  DeviceLogo: React.FC<SvgProps>;
};

export const CommonScanDeviceScreen: React.FC<Props> = ({
  titleText,
  descriptionText,
  DeviceLogo,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  return (
    <AutoLockView style={styles.root}>
      <AppBottomSheetModalTitle title={titleText} style={styles.titleText} />
      <View style={styles.main}>
        <Text style={styles.text}>{descriptionText}</Text>
        <View style={styles.imageWrapper}>
          <DeviceLogo />
          <View style={styles.progress}>
            <MaterialIndicator
              color={colors2024['blue-default']}
              size={240}
              trackWidth={2.5}
            />
          </View>
        </View>
      </View>
    </AutoLockView>
  );
};

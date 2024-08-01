import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppBottomSheetModalTitle } from '../customized/BottomSheet';
import { Text } from '../Text';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';
import { CircleSnail } from 'react-native-progress';
import { SvgProps } from 'react-native-svg';
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
    imageWrapper: {
      marginTop: 55,
      position: 'relative',
    },
    progress: {
      position: 'absolute',
      top: -15,
      left: -15,
    },
  });

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
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <AutoLockView style={styles.root}>
      <AppBottomSheetModalTitle title={titleText} />
      <View style={styles.main}>
        <Text style={styles.text}>{descriptionText}</Text>
        <View style={styles.imageWrapper}>
          <DeviceLogo />
          <CircleSnail
            color={[colors['blue-default']]}
            size={240}
            style={styles.progress}
          />
        </View>
      </View>
    </AutoLockView>
  );
};

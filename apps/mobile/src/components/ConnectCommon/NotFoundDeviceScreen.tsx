import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppBottomSheetModalTitle } from '../customized/BottomSheet';
import { Text } from '../Text';
import ErrorCircleSVG from '@/assets/icons/address/error-circle.svg';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';
import { Circle } from 'react-native-progress';
import { FooterButton } from '../FooterButton/FooterButton';
import { SvgProps } from 'react-native-svg';

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
    errorIcon: {
      position: 'absolute',
      bottom: 0,
      right: 0,
    },
  });

type Props = {
  onFooterButton?: () => void;
  titleText: string;
  descriptionText: string;
  footerButtonText?: string;
  DeviceLogo: React.FC<SvgProps>;
};

export const CommonNotFoundDeviceScreen: React.FC<Props> = ({
  titleText,
  descriptionText,
  footerButtonText,
  onFooterButton,
  DeviceLogo,
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.root}>
      <AppBottomSheetModalTitle title={titleText} />
      <View style={styles.main}>
        <Text style={styles.text}>{descriptionText}</Text>
        <View style={styles.imageWrapper}>
          <DeviceLogo />
          <Circle
            borderWidth={4}
            color={colors['red-default']}
            size={240}
            style={styles.progress}
          />
          <ErrorCircleSVG width={40} height={40} style={styles.errorIcon} />
        </View>
      </View>
      {footerButtonText ? (
        <FooterButton onPress={onFooterButton} title={footerButtonText} />
      ) : null}
    </View>
  );
};

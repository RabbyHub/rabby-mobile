import React from 'react';
import { View } from 'react-native';
import { AppBottomSheetModalTitle } from '../customized/BottomSheet';
import { Text } from '../Text';
import ErrorCircleSVG from '@/assets/icons/address/error-circle.svg';
import { useTheme2024 } from '@/hooks/theme';
import { SvgProps } from 'react-native-svg';
import { createGetStyles2024 } from '@/utils/styles';
import { Button } from '@/components2024/Button';

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
  errorIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  circle: {
    width: 240,
    height: 240,
    borderRadius: 1000,
    borderColor: colors2024['red-default'],
    borderWidth: 4,
  },
  titleText: {
    fontSize: 20,
    color: colors2024['neutral-title-1'],
    lineHeight: 24,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
  },
  footerButton: {
    marginBottom: 56,
    paddingHorizontal: 20,
  },
}));

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
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={styles.root}>
      <AppBottomSheetModalTitle title={titleText} style={styles.titleText} />
      <View style={styles.main}>
        <Text style={styles.text}>{descriptionText}</Text>
        <View style={styles.imageWrapper}>
          <DeviceLogo />
          <View style={styles.progress}>
            <View style={styles.circle} />
          </View>
          <ErrorCircleSVG width={40} height={40} style={styles.errorIcon} />
        </View>
      </View>
      {footerButtonText ? (
        <Button
          style={styles.footerButton}
          type="primary"
          onPress={onFooterButton}
          title={footerButtonText}
        />
      ) : null}
    </View>
  );
};

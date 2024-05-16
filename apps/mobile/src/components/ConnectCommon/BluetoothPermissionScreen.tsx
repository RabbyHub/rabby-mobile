import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppBottomSheetModalTitle } from '../customized/BottomSheet';
import { FooterButton } from '../FooterButton/FooterButton';
import { Text } from '../Text';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
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
    },
    text: {
      fontSize: 16,
      color: colors['neutral-body'],
      lineHeight: 20,
    },
    list: {
      marginBottom: 24,
    },
    logo: {
      marginTop: 55,
    },
  });

type Props = {
  onNext: () => void;
  titleText: string;
  descriptionText: string;
  DeviceLogo: React.FC<SvgProps>;
};

export const CommonBluetoothPermissionScreen: React.FC<Props> = ({
  titleText,
  descriptionText,
  onNext,
  DeviceLogo,
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.root}>
      <AppBottomSheetModalTitle title={titleText} />
      <View style={styles.main}>
        <Text style={styles.text}>{descriptionText}</Text>
        <DeviceLogo style={styles.logo} />
      </View>
      <FooterButton type="primary" onPress={onNext} title={t('global.next')} />
    </View>
  );
};

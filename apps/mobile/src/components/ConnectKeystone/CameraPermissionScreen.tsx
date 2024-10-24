import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppBottomSheetModalTitle } from '../customized/BottomSheet';
import { FooterButton } from '../FooterButton/FooterButton';
import { Text } from '../Text';
import ScanKeystoneSVG from '@/assets/icons/sign/scan-keystone.svg';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';

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

export const CameraPermissionScreen: React.FC<{
  onNext: () => void;
}> = ({ onNext }) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.root}>
      <AppBottomSheetModalTitle
        title={t('page.newAddress.keystone.camera.title')}
      />
      <View style={styles.main}>
        <Text style={styles.text}>
          {t('page.newAddress.keystone.camera.description')}
        </Text>
        <ScanKeystoneSVG style={styles.logo} />
      </View>
      <FooterButton type="primary" onPress={onNext} title={t('global.next')} />
    </View>
  );
};

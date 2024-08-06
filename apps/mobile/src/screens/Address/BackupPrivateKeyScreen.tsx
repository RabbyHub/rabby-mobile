import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FooterButtonScreenContainer } from '@/components/ScreenContainer/FooterButtonScreenContainer';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { RcIconInfo2CC } from '@/assets/icons/common';
import QRCode from 'react-native-qrcode-svg';
import { RootNames } from '@/constant/layout';
import { CopyAddressIcon } from '@/components/AddressViewer/CopyAddress';
import { MaskContainer } from './components/MaskContainer';

const QR_CODE_WIDTH = Dimensions.get('window').width - 130;

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    alert: {
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors['red-default'],
      backgroundColor: colors['red-light'],
      gap: 6,
      borderRadius: 8,
      flexDirection: 'row',
    },
    alertText: {
      color: colors['red-default'],
      fontSize: 14,
      flex: 1,
    },
    qrCodeContainer: {
      backgroundColor: colors['neutral-bg1'],
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors['neutral-line'],
      width: QR_CODE_WIDTH + 20,
      height: QR_CODE_WIDTH + 20,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    },
    main: {
      gap: 40,
      flex: 1,
      alignItems: 'center',
    },
    privateKeyContainer: {
      backgroundColor: colors['neutral-card-1'],
      borderRadius: 8,
      padding: 12,
      height: 100,
      width: '100%',
      position: 'relative',
      overflow: 'hidden',
    },
    privateKeyContainerText: {
      color: colors['neutral-title1'],
      fontSize: 15,
      lineHeight: 20,
    },
    copyButton: {
      position: 'absolute',
      right: 6,
      bottom: 6,
    },
  });

export const BackupPrivateKeyScreen = () => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();
  const nav = useNavigation();
  const { data } = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.BackupPrivateKey)?.params,
  ) as {
    data: string;
  };

  const handleDone = React.useCallback(() => {
    nav.goBack();
  }, [nav]);

  const [maskQrcodeVisible, setMaskQrcodeVisible] = React.useState(true);
  const [maskTextVisible, setMaskTextVisible] = React.useState(true);

  return (
    <FooterButtonScreenContainer
      buttonText={t('global.Done')}
      onPressButton={handleDone}>
      <View style={styles.main}>
        <View style={styles.alert}>
          <RcIconInfo2CC color={colors['red-default']} />
          <Text style={styles.alertText}>
            {t('page.backupPrivateKey.alert')}
          </Text>
        </View>

        <View style={styles.qrCodeContainer}>
          <MaskContainer
            masked={maskQrcodeVisible}
            onPress={v => setMaskQrcodeVisible(v)}
            textSize={17}
            logoSize={52}
            textGap={16}
            flexDirection="column"
            text={t('page.backupPrivateKey.clickToShowQr')}
          />
          {!maskQrcodeVisible && data && (
            <QRCode size={QR_CODE_WIDTH} value={data} />
          )}
        </View>
        <View style={styles.privateKeyContainer}>
          <MaskContainer
            masked={maskTextVisible}
            // isLight
            text={t('page.backupPrivateKey.clickToShow')}
            onPress={v => setMaskTextVisible(v)}
          />
          <Text style={styles.privateKeyContainerText}>
            {!maskTextVisible ? data : null}
          </Text>
          <CopyAddressIcon style={styles.copyButton} address={data} />
        </View>
      </View>
    </FooterButtonScreenContainer>
  );
};

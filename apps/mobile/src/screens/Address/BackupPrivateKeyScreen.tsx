import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FooterButtonScreenContainer } from '@/components/ScreenContainer/FooterButtonScreenContainer';
import { useNavigation, useRoute } from '@react-navigation/native';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import { RcIconInfo2CC } from '@/assets/icons/common';
import QRCode from 'react-native-qrcode-svg';
import { RootNames } from '@/constant/layout';
import { CopyAddressIcon } from '@/components/AddressViewer/CopyAddress';
import { MaskContainer } from './components/MaskContainer';
import { toast } from '@/components2024/Toast';
import i18next from 'i18next';
import { onCopiedSensitiveData } from '@/utils/clipboard';

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

const FAKE_QRCODE_INPUT =
  '0x' +
  Array(64)
    .fill(undefined)
    .map(() => Math.floor(Math.random() * 10))
    .join('');
export const BackupPrivateKeyScreen = () => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();
  const nav = useNavigation();
  const route =
    useRoute<
      GetNestedScreenRouteProp<'AddressNavigatorParamList', 'BackupPrivateKey'>
    >();
  const { data } = route.params || {};

  const handleDone = React.useCallback(() => {
    nav.goBack();
  }, [nav]);

  const [maskQrcodeVisible, setMaskQrcodeVisible] = React.useState(true);
  const [maskTextVisible, setMaskTextVisible] = React.useState(true);

  const qrcodeData =
    React.useMemo(() => {
      return !maskQrcodeVisible ? data : FAKE_QRCODE_INPUT;
    }, [maskQrcodeVisible, data]) || '';

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
          {!!qrcodeData && <QRCode size={QR_CODE_WIDTH} value={qrcodeData} />}
        </View>
        <View style={styles.privateKeyContainer}>
          <MaskContainer
            masked={maskTextVisible}
            isLight
            text={t('page.backupPrivateKey.clickToShow')}
            onPress={v => setMaskTextVisible(v)}
          />
          {!maskTextVisible && (
            <>
              <Text style={styles.privateKeyContainerText}>{data}</Text>
              <CopyAddressIcon
                style={styles.copyButton}
                address={data}
                onToastSuccess={() => {
                  toast.success(i18next.t('global.copied'));
                  onCopiedSensitiveData({ type: 'privateKey' });
                }}
              />
            </>
          )}
        </View>
      </View>
    </FooterButtonScreenContainer>
  );
};

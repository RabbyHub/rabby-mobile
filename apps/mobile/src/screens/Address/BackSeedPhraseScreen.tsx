import { AppColorsVariants, ThemeColors } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FooterButtonScreenContainer } from '@/components/ScreenContainer/FooterButtonScreenContainer';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { RcIconInfo2CC } from '@/assets/icons/common';
import { RootNames } from '@/constant/layout';
import { CopyAddressIcon } from '@/components/AddressViewer/CopyAddress';
import { MaskContainer } from './components/MaskContainer';
import QrCodeSVG from '@/assets/icons/common/qrcode-cc.svg';
import { AppBottomSheetModal, AppBottomSheetModalTitle } from '@/components';
import QRCode from 'react-native-qrcode-svg';
import { WINDOW_WIDTH } from '@gorhom/bottom-sheet';

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
    seedPhraseContainer: {
      backgroundColor: colors['neutral-card-1'],
      borderRadius: 8,
      padding: 12,
      height: 140,
      position: 'relative',
      overflow: 'hidden',
      width: '100%',
      marginTop: 12,
    },
    main: {
      gap: 20,
      flex: 1,
      alignItems: 'center',
    },
    seedPhraseContainerText: {
      color: colors['neutral-title1'],
      fontSize: 15,
      lineHeight: 20,
    },
    copyButtonText: {
      color: colors['neutral-body'],
      fontSize: 15,
    },
    copyButton: {
      height: 18,
      flexDirection: 'row',
      gap: 6,
    },
    buttonGroup: {
      flexDirection: 'row',
      gap: 24,
    },
    qrCodeModalContainer: {
      paddingHorizontal: 20,
    },
    qrCodeWrap: {
      borderWidth: 1,
      padding: 12,
      borderColor: colors['neutral-line'],
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      width: WINDOW_WIDTH - 120,
      height: WINDOW_WIDTH - 120,
      marginTop: 20,
      backgroundColor: ThemeColors.light['neutral-card-1'],
    },
    qrCodeView: {
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export const BackSeedPhraseScreen = () => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();
  const nav = useNavigation();
  const { data } = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.BackupMnemonic)?.params,
  ) as {
    data: string;
  };
  const [visibleCopyButton, setVisibleCopyButton] = React.useState(false);

  const handleDone = React.useCallback(() => {
    nav.goBack();
  }, [nav]);

  const onPressMask = React.useCallback(() => {
    setVisibleCopyButton(true);
  }, []);

  const qrCodeModalRef = React.useRef<AppBottomSheetModal>(null);

  return (
    <FooterButtonScreenContainer
      buttonText={t('global.Done')}
      onPressButton={handleDone}>
      <View style={styles.main}>
        <View style={styles.alert}>
          <RcIconInfo2CC color={colors['red-default']} />
          <Text style={styles.alertText}>
            {t('page.backupSeedPhrase.alert')}
          </Text>
        </View>

        <View style={styles.seedPhraseContainer}>
          <MaskContainer
            logoSize={40}
            textGap={13}
            textSize={17}
            flexDirection="column"
            text={t('page.backupSeedPhrase.clickToShow')}
            onPress={onPressMask}
          />
          <Text style={styles.seedPhraseContainerText}>{data}</Text>
        </View>

        {visibleCopyButton && (
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              onPress={() => {
                qrCodeModalRef.current?.present();
              }}
              style={styles.copyButton}>
              <QrCodeSVG
                width={16}
                height={16}
                color={colors['neutral-body']}
              />
              <Text style={styles.copyButtonText}>
                {t('page.backupSeedPhrase.showQrCode')}
              </Text>
            </TouchableOpacity>
            <CopyAddressIcon
              style={styles.copyButton}
              title={t('page.backupSeedPhrase.copySeedPhrase')}
              address={data}
              color={colors['neutral-body']}
              titleStyle={styles.copyButtonText}
            />
          </View>
        )}
      </View>
      <AppBottomSheetModal snapPoints={['60%']} ref={qrCodeModalRef}>
        <AppBottomSheetModalTitle
          title={t('page.backupSeedPhrase.qrCodePopupTitle')}
        />
        <View style={styles.qrCodeModalContainer}>
          <View style={styles.alert}>
            <RcIconInfo2CC color={colors['red-default']} />
            <Text style={styles.alertText}>
              {t('page.backupSeedPhrase.qrCodePopupTips')}
            </Text>
          </View>
          <View style={styles.qrCodeView}>
            <View style={styles.qrCodeWrap}>
              <QRCode value={data} size={WINDOW_WIDTH - 160} />
            </View>
          </View>
        </View>
      </AppBottomSheetModal>
    </FooterButtonScreenContainer>
  );
};

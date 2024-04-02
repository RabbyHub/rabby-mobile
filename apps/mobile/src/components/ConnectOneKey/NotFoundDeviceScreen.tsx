import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppBottomSheetModalTitle } from '../customized/BottomSheet';
import { Text } from '../Text';
import ScanLedgerSVG from '@/assets/icons/sign/scan-ledger.svg';
import ErrorCircleSVG from '@/assets/icons/address/error-circle.svg';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';
import { Circle } from 'react-native-progress';
import { FooterButton } from '../FooterButton/FooterButton';
import { openExternalUrl } from '@/core/utils/linking';

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

export const NotFoundDeviceScreen: React.FC<{}> = () => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const handleButton = React.useCallback(() => {
    openExternalUrl(
      'https://support.ledger.com/hc/en-us/articles/360025864773-Fix-Bluetooth-pairing-issues?support=true',
    );
  }, []);

  return (
    <View style={styles.root}>
      <AppBottomSheetModalTitle
        title={t('page.newAddress.ledger.notFound.title')}
      />
      <View style={styles.main}>
        <Text style={styles.text}>
          {t('page.newAddress.ledger.notFound.description')}
        </Text>
        <View style={styles.imageWrapper}>
          <ScanLedgerSVG />
          <Circle
            borderWidth={4}
            color={colors['red-default']}
            size={240}
            style={styles.progress}
          />
          <ErrorCircleSVG width={40} height={40} style={styles.errorIcon} />
        </View>
      </View>
      <FooterButton
        onPress={handleButton}
        title={t('page.newAddress.ledger.notFound.buttonText')}
      />
    </View>
  );
};

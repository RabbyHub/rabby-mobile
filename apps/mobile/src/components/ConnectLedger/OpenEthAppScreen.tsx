import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppBottomSheetModalTitle } from '../customized/BottomSheet';
import { Text } from '../Text';
import ScanLedgerSVG from '@/assets/icons/sign/scan-ledger.svg';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';

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

export const OpenEthAppScreen: React.FC<{}> = ({}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.root}>
      <AppBottomSheetModalTitle
        title={t('page.newAddress.ledger.openEthApp.title')}
      />
      <View style={styles.main}>
        <Text style={styles.text}>
          {t('page.newAddress.ledger.openEthApp.description')}
        </Text>
        <View style={styles.imageWrapper}>
          <ScanLedgerSVG />
        </View>
      </View>
    </View>
  );
};

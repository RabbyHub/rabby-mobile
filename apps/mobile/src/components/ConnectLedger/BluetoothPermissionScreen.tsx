import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppBottomSheetModalTitle } from '../customized/BottomSheet';
import { FooterButton } from '../FooterButton/FooterButton';
import { Text } from '../Text';
import ScanLedgerSVG from '@/assets/icons/sign/scan-ledger.svg';
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
  });

export const BluetoothPermissionScreen: React.FC<{
  onNext: () => void;
}> = ({ onNext }) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.root}>
      <AppBottomSheetModalTitle title={t('page.newAddress.ledger.title')} />
      <View style={styles.main}>
        <View style={styles.list}>
          <Text style={styles.text}>1. Plug in a single Ledger</Text>
          <Text style={styles.text}>2. Enter pin to unlock</Text>
          <Text style={styles.text}>3. Open Ethereum App</Text>
        </View>
        <ScanLedgerSVG />
      </View>
      <FooterButton type="primary" onPress={onNext} title={t('global.next')} />
    </View>
  );
};

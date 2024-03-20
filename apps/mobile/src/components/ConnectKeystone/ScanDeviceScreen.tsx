import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppBottomSheetModalTitle } from '../customized/BottomSheet';
import { Text } from '../Text';
import ScanLedgerSVG from '@/assets/icons/sign/scan-ledger.svg';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';
import { CircleSnail } from 'react-native-progress';

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
  });

export const ScanDeviceScreen: React.FC<{}> = () => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.root}>
      <AppBottomSheetModalTitle
        title={t('page.newAddress.keystone.scan.title')}
      />
      <View style={styles.main}>
        <Text style={styles.text}>
          {t('page.newAddress.keystone.scan.description')}
        </Text>
        <View style={styles.imageWrapper}>
          <ScanLedgerSVG />
          <CircleSnail
            color={[colors['blue-default']]}
            size={240}
            style={styles.progress}
          />
        </View>
      </View>
    </View>
  );
};

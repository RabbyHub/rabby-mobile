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
      marginTop: 74,
      position: 'relative',
    },
    progress: {
      position: 'absolute',
    },
  });

export const ScanDeviceScreen: React.FC<{}> = () => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.root}>
      <AppBottomSheetModalTitle title={t('正在查找设备')} />
      <View style={styles.main}>
        <Text style={styles.text}>
          确保您已启用蓝牙且已解锁您的Ledger Nano X
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

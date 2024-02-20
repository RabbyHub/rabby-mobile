import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppBottomSheetModalTitle } from '../customized/BottomSheet';
import { Text } from '../Text';

const getStyles = () =>
  StyleSheet.create({
    root: {
      height: '100%',
      position: 'relative',
    },
    main: {
      flex: 1,
    },
  });

export const ScanDeviceScreen: React.FC<{}> = () => {
  const { t } = useTranslation();
  const styles = getStyles();

  return (
    <View style={styles.root}>
      <AppBottomSheetModalTitle title={t('正在查找设备')} />
      <View style={styles.main}>
        <Text>确保您已启用蓝牙且已解锁您的Ledger Nano X</Text>
        <Text>TODO</Text>
      </View>
    </View>
  );
};

import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppBottomSheetModalTitle } from '../customized/BottomSheet';
import { FooterButton } from '../FooterButton/FooterButton';
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

export const BluetoothPermissionScreen: React.FC<{
  onNext: () => void;
}> = ({ onNext }) => {
  const { t } = useTranslation();
  const styles = getStyles();

  return (
    <View style={styles.root}>
      <AppBottomSheetModalTitle title={t('page.newAddress.ledger.title')} />
      <View style={styles.main}>
        <Text>TODO</Text>
      </View>
      <FooterButton type="primary" onPress={onNext} title={t('global.next')} />
    </View>
  );
};

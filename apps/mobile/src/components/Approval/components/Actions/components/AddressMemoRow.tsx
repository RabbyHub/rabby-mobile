import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import useCommonStyle from '@/components/Approval/hooks/useCommonStyle';
import AddressMemo from './AddressMemo';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: 12,
  },
  title: {
    // A zero-width title still produces multiple lines of height on Android.
    flexShrink: 0,
    maxWidth: '50%',
  },
  value: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
  },
});

export const AddressMemoRow = ({
  address,
  textStyle,
}: {
  address: string;
  textStyle?: TextStyle;
}) => {
  const { t } = useTranslation();
  const commonStyle = useCommonStyle();

  return (
    <View style={styles.row}>
      <Text style={[commonStyle.subRowTitleText, styles.title]}>
        {t('page.signTx.addressNote')}
      </Text>
      <View style={styles.value}>
        <AddressMemo address={address} textStyle={textStyle} />
      </View>
    </View>
  );
};

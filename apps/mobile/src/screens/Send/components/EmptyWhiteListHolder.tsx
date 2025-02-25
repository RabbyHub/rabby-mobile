import React from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Card } from '@/components2024/Card';
import { Pressable, View, Text } from 'react-native';

const EmptyWhiteListHolder = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const gotoAddWhitelist = () => {
    console.log('🔍 CUSTOM_LOGGER:=>: gotoAddWhitelist');
  };

  return (
    <Card>
      <Text style={styles.header1}>Add Whitelist Address</Text>
      <Text style={styles.header2}>
        After Whitelist Address After address After Whitelist Address
      </Text>
      <Card style={styles.holder}>
        <Text>placeholder</Text>
      </Card>
      <View style={styles.footer}>
        <Text style={styles.footerText}>No whitelist Address yet, </Text>
        <Pressable style={styles.footerBtn} onPress={gotoAddWhitelist}>
          <Text style={styles.footerBtnText}>To Add</Text>
        </Pressable>
      </View>
    </Card>
  );
};

export default EmptyWhiteListHolder;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  header1: {
    position: 'relative',
    color: colors2024['neutral-title-1'],
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 22,
  },
  header2: {
    color: colors2024['neutral-secondary'],
    fontSize: 16,
    width: '100%',
    fontFamily: 'SF Pro Rounded',
    marginTop: 15,
    marginBottom: 20,
  },
  holder: {
    width: '100%',
    marginBottom: 28,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
    lineHeight: 24,
  },
  footerBtn: {},
  footerBtnText: {
    fontFamily: 'SF Pro Rounded',
    color: colors2024['brand-default'],
    fontWeight: '800',
    fontSize: 16,
    lineHeight: 24,
  },
}));

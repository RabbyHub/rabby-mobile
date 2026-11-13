import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AccountsPanelInSheetModal } from '@/components/AccountSelector/AccountsPanel';
import { Text } from '@/components/Typography';
import type { Account } from '@/types/account';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

export function ReceiveAddressListSheet({
  onSelectAccount,
}: {
  onSelectAccount?: (account: Account | null) => void;
}) {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('page.receiveAddressList.title')}</Text>
      <Text style={styles.subtitle}>
        {t('page.receiveAddressList.subtitle')}
      </Text>
      <AccountsPanelInSheetModal
        containerStyle={styles.accountRoot}
        onSelectAccount={onSelectAccount}
        scene="receive"
        isReceiveSheet
      />
    </View>
  );
}

const getStyle = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
    paddingTop: 12,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    color: ctx.colors2024['neutral-title-1'],
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: ctx.colors2024['neutral-secondary'],
    textAlign: 'center',
  },
  accountRoot: {
    flex: 1,
    minHeight: 0,
    maxHeight: '100%',
    marginTop: 20,
    backgroundColor: 'transparent',
  },
}));

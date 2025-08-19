import RcIconEmpty from '@/assets/icons/dapp/dapp-history-empty.svg';
import RcIconEmptyDark from '@/assets/icons/dapp/dapp-history-empty-dark.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

export const BrowserHistoryEmpty = () => {
  const { styles, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <View style={styles.empty}>
      {isLight ? (
        <RcIconEmpty style={styles.emptyIcon} />
      ) : (
        <RcIconEmptyDark style={styles.emptyIcon} />
      )}
      <Text style={styles.emptyText}>
        {t('page.browserManage.BrowserHistoryList.emptyTitle')}
      </Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  empty: {
    paddingVertical: 20,

    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,

    marginHorizontal: 4,
  },
  emptyIcon: {
    width: 163,
    height: 126,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
  },
}));

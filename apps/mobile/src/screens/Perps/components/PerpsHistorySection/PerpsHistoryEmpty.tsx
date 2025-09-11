import RcIconEmptyDark from '@/assets/icons/dapp/dapp-history-empty-dark.svg';
import RcIconEmpty from '@/assets/icons/dapp/dapp-history-empty.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

export const PerpsHistoryEmpty = () => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <View style={[styles.empty]}>
      {isLight ? (
        <RcIconEmpty style={styles.emptyIcon} />
      ) : (
        <RcIconEmptyDark style={styles.emptyIcon} />
      )}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  empty: {
    borderRadius: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  emptyIcon: {},
}));

import RcIconEmpty from '@/assets/icons/dapp/dapp-history-empty.svg';
import RcIconEmptyDark from '@/assets/icons/dapp/dapp-history-empty-dark.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Text, View } from 'react-native';

export const DappHistorySectionEmpty = () => {
  const { styles, isLight } = useTheme2024({ getStyle });

  return (
    <View style={styles.empty}>
      {isLight ? (
        <RcIconEmpty style={styles.emptyIcon} />
      ) : (
        <RcIconEmptyDark style={styles.emptyIcon} />
      )}
      <Text style={styles.emptyText}>No history in the past 30 days</Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  empty: {
    borderRadius: 20,
    backgroundColor: colors2024['neutral-bg-1'],
    borderStyle: 'solid',
    borderColor: colors2024['neutral-line'],
    borderWidth: 1,
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
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-info'],
    textAlign: 'center',
  },
}));

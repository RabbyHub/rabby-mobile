import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Text, View } from 'react-native';
import RcIconEmpty from '@/assets/icons/dapp/dapp-history-empty.svg';
import RcIconEmptyDark from '@/assets/icons/dapp/dapp-history-empty-dark.svg';
import { IS_IOS } from '@/core/native/utils';
import { RcIconDynamicArrowCC } from '@/assets/icons/dapp';

export const BrowserTabEmpty = () => {
  const { styles, isLight, colors2024 } = useTheme2024({ getStyle });

  return (
    <View style={styles.empty}>
      <View style={styles.emptyContent}>
        {isLight ? (
          <RcIconEmpty style={styles.emptyIcon} />
        ) : (
          <RcIconEmptyDark style={styles.emptyIcon} />
        )}
        <Text style={styles.emptyTitle}>No open tabs yet</Text>
        <Text style={styles.emptyText}>Open a new tab now</Text>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  emptyContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  emptyIcon: {
    width: 163,
    height: 126,
  },
  emptyTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
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

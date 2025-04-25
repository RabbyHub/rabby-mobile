import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Text, View } from 'react-native';
import RcIconEmpty from '@/assets/icons/dapp/dapp-history-empty.svg';
import RcIconEmptyDark from '@/assets/icons/dapp/dapp-history-empty-dark.svg';
import { IS_IOS } from '@/core/native/utils';
import { RcIconDynamicArrowCC } from '@/assets/icons/dapp';

export const BrowserBookmarkEmpty = () => {
  const { styles, isLight, colors2024 } = useTheme2024({ getStyle });

  return (
    <View style={styles.empty}>
      <RcIconDynamicArrowCC color={colors2024['neutral-line']} />
      <View style={styles.emptyContent}>
        {isLight ? (
          <RcIconEmpty style={styles.emptyIcon} />
        ) : (
          <RcIconEmptyDark style={styles.emptyIcon} />
        )}
        <Text style={styles.emptyText}>
          {IS_IOS ? 'Starting Exploring' : 'Starting Exploring Dapp'}
        </Text>
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
  emptyText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-info'],
    textAlign: 'center',
  },
}));

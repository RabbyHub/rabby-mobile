import React from 'react';
import { View } from 'react-native';

import { AssetAvatar } from '@/components';
import { ScreenHeaderAccountSwitcher } from '@/components/AccountSwitcher/OnScreenHeader';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

import type { AbstractPortfolioToken } from '@/screens/Home/types';

/**
 * Route-level title for the history list screens (multi-address list and the
 * single-address variant).
 *
 * Declared on the route so the header exists before the list mounts; the token
 * context (when the list was opened from a token detail) arrives through route
 * params instead of a `setOptions` call after mount.
 */
export function HistoryListHeaderTitle({
  isForMultipleAddress,
  isInTokenDetail,
  tokenItem,
}: {
  isForMultipleAddress: boolean;
  isInTokenDetail?: boolean;
  tokenItem?: AbstractPortfolioToken;
}) {
  const { styles } = useTheme2024({ getStyle });

  const titleText =
    isInTokenDetail && tokenItem ? (
      <View style={styles.titleRow}>
        <AssetAvatar
          logo={tokenItem.logo_url}
          size={24}
          chain={tokenItem.chain}
          chainSize={10}
        />
        <Text style={styles.titleText}>{tokenItem.symbol}</Text>
        <Text style={styles.titleText}>Transactions</Text>
      </View>
    ) : (
      'Transactions'
    );

  return (
    <ScreenHeaderAccountSwitcher
      forScene={isForMultipleAddress ? 'MultiHistory' : 'History'}
      titleText={titleText}
      // Only the single-address history has no switcher modal; the multi-address
      // list must keep its caret and tap-to-switch behaviour (QA 1390).
      disableSwitch={!isForMultipleAddress}
    />
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  titleText: {
    marginLeft: 4,
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
  },
}));

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useEffect } from 'react';
import { View } from 'react-native';

import type { Account } from '@/core/services/preference';
import { Text } from '@/components/Typography';
import { HeaderBackPressable, useRabbyAppNavigation } from '@/hooks/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RcIconAAVE from '@/assets2024/icons/lending/IconAAVE.svg';
import { LendingHistoryHeader } from './Header';
import { HeaderAccountSwitcher } from '@/components/AccountSwitcher/HeaderAccountSwitcher';

const HEADER_HEIGHT = 58;

const LendingHeaderContent: React.FC<{
  onPendingClear?: () => void;
}> = ({ onPendingClear }) => {
  const { styles } = useTheme2024({ getStyle });
  const { top } = useSafeAreaInsets();

  return (
    <View style={[styles.headerOuter, { marginTop: top }]}>
      <View style={styles.headerInner}>
        <View style={styles.headerLeft}>
          <HeaderBackPressable />
          <RcIconAAVE />
          <Text style={styles.title}>Aave</Text>
        </View>

        <View style={styles.headerRight}>
          <HeaderAccountSwitcher
            forScene="Lending"
            style={styles.headerAccountSwitcher}
          />
          <LendingHistoryHeader onPendingClear={onPendingClear} />
        </View>
      </View>
    </View>
  );
};

export const LendingNativeHeader: React.FC<{
  account?: Account | null;
  onPendingClear?: () => void;
}> = ({ onPendingClear }) => {
  const { colors2024 } = useTheme2024({ getStyle });
  const navigation = useRabbyAppNavigation();

  useEffect(() => {
    navigation.setOptions({
      // eslint-disable-next-line react/no-unstable-nested-components
      header: () => <LendingHeaderContent onPendingClear={onPendingClear} />,
      headerStyle: {
        backgroundColor: colors2024['neutral-bg-1'],
      },
    });
  }, [navigation, colors2024, onPendingClear]);

  return null;
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  headerOuter: {
    height: HEADER_HEIGHT,
    paddingHorizontal: 12,
    paddingRight: 16,
    paddingVertical: 10,
  },
  headerInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    minWidth: 0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    justifyContent: 'flex-end',
    gap: 12,
  },
  headerAccountSwitcher: {
    flexShrink: 1,
    minWidth: 0,
  },
}));

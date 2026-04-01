import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useEffect, useMemo } from 'react';
import { TouchableOpacity, View } from 'react-native';

import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { apiContact } from '@/core/apis';
import { Account } from '@/core/services/preference';
import { ellipsisAddress } from '@/utils/address';
import { CaretArrowIconCC } from '@/components/Icons/CaretArrowIconCC';
import { Text } from '@/components/Typography';
import { HeaderBackPressable, useRabbyAppNavigation } from '@/hooks/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RcIconAAVE from '@/assets2024/icons/lending/IconAAVE.svg';
import { LendingHistoryHeader } from './Header';
import { useAccountSceneVisible } from '@/components/AccountSwitcher/hooks';

const HEADER_HEIGHT = 58;

const LendingHeaderContent: React.FC<{
  account?: Account | null;
  onPendingClear?: () => void;
}> = ({ account, onPendingClear }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { top } = useSafeAreaInsets();
  const { isVisible, toggleSceneVisible } = useAccountSceneVisible('Lending');

  const alias = useMemo(() => {
    if (!account?.address) {
      return;
    }
    return apiContact.getAliasName(account?.address);
  }, [account?.address]);

  return (
    <View style={[styles.headerOuter, { marginTop: top }]}>
      <View style={styles.headerInner}>
        <View style={styles.headerLeft}>
          <HeaderBackPressable />
          <RcIconAAVE />
          <Text style={styles.title}>Aave</Text>
        </View>

        <View style={styles.headerRight}>
          {account ? (
            <TouchableOpacity
              style={styles.accountSelector}
              onPress={() => {
                toggleSceneVisible('Lending', !isVisible);
              }}>
              <WalletIcon
                width={18}
                height={18}
                type={account.brandName}
                address={account.address}
              />
              <Text style={styles.accountName} numberOfLines={1}>
                {alias || ellipsisAddress(account.address)}
              </Text>
              <CaretArrowIconCC
                dir="down"
                style={isVisible ? styles.reverseCaret : null}
                width={18}
                height={18}
                bgColor={colors2024['neutral-bg-5']}
                lineColor={colors2024['neutral-title-1']}
              />
            </TouchableOpacity>
          ) : null}
          <LendingHistoryHeader onPendingClear={onPendingClear} />
        </View>
      </View>
    </View>
  );
};

export const LendingNativeHeader: React.FC<{
  account?: Account | null;
  onPendingClear?: () => void;
}> = ({ account, onPendingClear }) => {
  const { colors2024 } = useTheme2024({ getStyle });
  const navigation = useRabbyAppNavigation();

  useEffect(() => {
    navigation.setOptions({
      // eslint-disable-next-line react/no-unstable-nested-components
      header: () => (
        <LendingHeaderContent
          account={account}
          onPendingClear={onPendingClear}
        />
      ),
      headerStyle: {
        backgroundColor: colors2024['neutral-bg-1'],
      },
    });
  }, [navigation, colors2024, account, onPendingClear]);

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    gap: 12,
  },
  accountSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors2024['neutral-bg-5'],
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    maxWidth: 160,
  },
  accountName: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    color: colors2024['neutral-title-1'],
    flexShrink: 1,
  },
  reverseCaret: {
    transform: [{ rotate: '180deg' }],
  },
}));

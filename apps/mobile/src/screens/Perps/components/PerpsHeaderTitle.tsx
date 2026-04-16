import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useEffect, useMemo } from 'react';
import { TouchableOpacity, View } from 'react-native';

import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { apiContact } from '@/core/apis';
import { Account } from '@/core/services/preference';
import { ellipsisAddress } from '@/utils/address';
import { usePerpsPopupState } from '../hooks/usePerpsPopupState';
import { CaretArrowIconCC } from '@/components/Icons/CaretArrowIconCC';
import { Text } from '@/components/Typography';
import { HeaderBackPressable, useRabbyAppNavigation } from '@/hooks/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RcIconHyper from '@/assets2024/icons/perps/IconHyper.svg';
import { PerpHistoryHeader } from './PerpHistoryHeader';
import { AccountHistoryItem } from '@/hooks/perps/usePerpsStore';

const HEADER_HEIGHT = 58;

/**
 * Extracted as a standalone component so React Navigation
 * re-renders it on prop changes instead of stale closures.
 */
const PerpsHeaderContent: React.FC<{
  account?: Account | null;
  localLoadingHistory: AccountHistoryItem[];
}> = ({ account, localLoadingHistory }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { top } = useSafeAreaInsets();
  const [popupState, setPopupState] = usePerpsPopupState();

  const alias = useMemo(() => {
    if (!account?.address) {
      return;
    }
    return apiContact.getAliasName(account?.address);
  }, [account?.address]);

  return (
    <View style={[styles.headerOuter, { marginTop: top }]}>
      <View style={styles.headerInner}>
        {/* Left: back + icon + title */}
        <View style={styles.headerLeft}>
          <HeaderBackPressable />
          <RcIconHyper />
          <Text style={styles.title}>Perps</Text>
        </View>

        {/* Right: account selector + history */}
        <View style={styles.headerRight}>
          {account ? (
            <View style={styles.accountSelectorContainer}>
              <TouchableOpacity
                style={styles.accountSelector}
                onPress={() => {
                  setPopupState(prev => ({
                    ...prev,
                    isShowLoginPopup: !prev.isShowLoginPopup,
                  }));
                }}>
                <WalletIcon
                  width={18}
                  height={18}
                  type={account.brandName}
                  address={account.address}
                />
                <Text style={styles.accountName} numberOfLines={1}>
                  {alias || ellipsisAddress(account?.address)}
                </Text>
                <CaretArrowIconCC
                  dir="down"
                  style={[
                    popupState.isShowLoginPopup ? styles.reverseCaret : null,
                  ]}
                  width={18}
                  height={18}
                  bgColor={colors2024['neutral-bg-5']}
                  lineColor={colors2024['neutral-title-1']}
                />
              </TouchableOpacity>
            </View>
          ) : null}
          <PerpHistoryHeader localLoadingHistory={localLoadingHistory} />
        </View>
      </View>
    </View>
  );
};

export const PerpsNativeHeader: React.FC<{
  account?: Account | null;
  localLoadingHistory: AccountHistoryItem[];
}> = ({ account, localLoadingHistory }) => {
  const { colors2024 } = useTheme2024({ getStyle });
  const navigation = useRabbyAppNavigation();

  useEffect(() => {
    navigation.setOptions({
      // eslint-disable-next-line react/no-unstable-nested-components
      header: () => (
        <PerpsHeaderContent
          account={account}
          localLoadingHistory={localLoadingHistory}
        />
      ),
      headerStyle: {
        backgroundColor: colors2024['neutral-bg-1'],
      },
    });
  }, [navigation, colors2024, account, localLoadingHistory]);

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
    flex: 1,
    justifyContent: 'flex-end',
    gap: 12,
  },
  accountSelectorContainer: {
    flex: 1,
    justifyContent: 'flex-end',
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
    marginLeft: 'auto',
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

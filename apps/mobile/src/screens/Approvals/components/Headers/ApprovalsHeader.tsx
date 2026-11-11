import React from 'react';
import { View } from 'react-native';
import { useAtom } from 'jotai';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

import type { Account } from '@/core/startupServices/preference';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { HeaderBackPressable } from '@/hooks/navigation';
import { Text } from '@/components/Typography';
import { ellipsisAddress } from '@/utils/address';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { TopSearch } from '../TopSearch';
import { HeaderRight } from './HeaderRight';
import {
  approvalsSearchKwAtom,
  approvalsSearchingAtom,
} from '../../useApprovalsPage';

// Native nav-bar height; the search pill is 46pt so the row is slightly taller.
const HEADER_CONTENT_HEIGHT = 48;
// Matches `ApprovalsLayouts.innerContainerHorizontalOffset`, i.e. the left edge
// of the list cards below, so the back button's container and the trailing
// action line up with the page content (header layout contract, QA 1328/1344).
const HEADER_HORIZONTAL_INSET = 16;

/**
 * Fully custom header for the Approvals screen.
 *
 * The navigator owns it from the first descriptor, and the leading/trailing
 * items are laid out with the page's own content inset instead of the native
 * bar-item geometry. Centre content (wallet title / search field) can change
 * without ever moving the back button.
 */
export const ApprovalsHeader = ({ account }: { account?: Account | null }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const insets = useSafeAreaInsets();
  const [searchKw, setSearchKw] = useAtom(approvalsSearchKwAtom);
  const [isSearching, setIsSearching] = useAtom(approvalsSearchingAtom);

  return (
    <View style={[styles.outer, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <View
          style={[styles.backSlot, isSearching && styles.backSlotSearching]}>
          <HeaderBackPressable tintColor={colors2024['neutral-title-1']} />
        </View>
        <View style={styles.center}>
          {isSearching ? (
            <TopSearch value={searchKw} onChange={setSearchKw} />
          ) : (
            <View style={styles.title}>
              <WalletIcon
                type={account?.brandName as KEYRING_TYPE}
                address={account?.address}
                style={styles.walletIcon}
                width={25}
                height={25}
                borderRadius={6}
              />
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={styles.titleText}>
                {account?.aliasName || ellipsisAddress(account?.address || '')}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.rightSlot}>
          <HeaderRight
            isSearching={isSearching}
            onTap={() => {
              if (isSearching) {
                setSearchKw('');
              }
              setIsSearching(prev => !prev);
            }}
          />
        </View>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  outer: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
  row: {
    height: HEADER_CONTENT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: HEADER_HORIZONTAL_INSET,
  },
  // Same width as the trailing slot so the centre content is centred on the
  // screen. The chevron itself hugs the left edge, which is the page content's
  // left edge (16pt).
  backSlot: {
    width: 44,
    height: 24,
    alignItems: 'flex-start',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // While searching the field has to start right after the chevron, so the
  // leading slot shrinks to the glyph box.
  backSlotSearching: {
    width: 24,
  },
  center: {
    flex: 1,
    marginHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexShrink: 1,
  },
  titleText: {
    color: colors2024['neutral-title-1'],
    fontWeight: '900',
    fontSize: 20,
    fontFamily: 'SF Pro Rounded',
    lineHeight: 24,
    textAlign: 'center',
    flexShrink: 1,
  },
  walletIcon: {
    width: 25,
    height: 25,
    flexShrink: 0,
  },
  rightSlot: {
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
}));

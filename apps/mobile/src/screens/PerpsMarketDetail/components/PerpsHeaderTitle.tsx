import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useImperativeHandle, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';

import { AssetAvatar } from '@/components/AssetAvatar';
import { default as RcCaretDownCircleCC } from '@/components/AccountSwitcher/icons/caret-down-circle.svg';
import { default as RcCaretDownCircleDarkCC } from '@/components/AccountSwitcher/icons/caret-down-circle-dark.svg';
import type { Account } from '@/core/startupServices/preference';
import { formatPerpsCoin } from '@/utils/perps';
import { Text } from '@/components/Typography';
import { HeaderBackPressable } from '@/hooks/navigation';
import { PerpsHeaderRight } from './PerpsHeaderRight';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  EMPTY_ACCOUNT_QUOTE,
  sameAccountHeader,
  type AccountHeaderHandle,
  type AccountHeaderSnapshot,
} from './account/model';

export const PerpsHeaderTitle = React.memo(
  React.forwardRef<
    AccountHeaderHandle,
    {
      account?: Account | null;
      snapshotRef?: React.RefObject<AccountHeaderSnapshot>;
      onSelectCoin: () => void;
      popupIsOpen: boolean;
      coin: string;
      displayName: string;
      quoteCoin?: string;
      logoUrl?: string;
    }
  >(function PerpsHeaderTitle(
    {
      logoUrl,
      coin,
      displayName,
      quoteCoin = 'USDC',
      snapshotRef,
      onSelectCoin,
      popupIsOpen,
    },
    ref,
  ) {
    const { styles, colors2024, isLight } = useTheme2024({ getStyle });

    const { top } = useSafeAreaInsets();
    const IconCom = isLight ? RcCaretDownCircleCC : RcCaretDownCircleDarkCC;

    const [snapshot, setSnapshot] = useState<AccountHeaderSnapshot>(
      () =>
        snapshotRef?.current ?? { compact: false, quote: EMPTY_ACCOUNT_QUOTE },
    );
    useImperativeHandle(
      ref,
      () => ({
        update: next =>
          setSnapshot(previous =>
            sameAccountHeader(previous, next) ? previous : next,
          ),
      }),
      [],
    );
    const { compact, quote } = snapshot;

    return (
      <View style={[styles.headerOuter, { marginTop: top }]}>
        <View style={styles.headerInner}>
          <View style={styles.headerLeft}>
            <HeaderBackPressable tintColor={colors2024['neutral-title-1']} />
            <AssetAvatar logo={logoUrl} logoStyle={styles.icon} size={26} />
            <TouchableOpacity onPress={onSelectCoin} style={styles.touchable}>
              <Text style={styles.text} numberOfLines={1}>
                {formatPerpsCoin(displayName)}/{quoteCoin}
              </Text>
              <IconCom
                width={18}
                height={18}
                style={[
                  styles.addressCaretIcon,
                  popupIsOpen && styles.reverseCaret,
                ]}
                color={colors2024['neutral-bg-4']}
              />
            </TouchableOpacity>
          </View>
          {compact ? (
            <View style={styles.quoteColumn}>
              <Text style={styles.price} numberOfLines={1}>
                {quote.price}
              </Text>
            </View>
          ) : (
            <PerpsHeaderRight marketName={coin} />
          )}
        </View>
      </View>
    );
  }),
);

const HEADER_HEIGHT = 56;

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  headerOuter: {
    height: HEADER_HEIGHT,
    paddingLeft: 12,
    paddingRight: 16,
    justifyContent: 'center',
    backgroundColor: colors2024[isLight ? 'neutral-bg-0' : 'neutral-bg-1'],
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    minWidth: 0,
  },
  touchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
    minWidth: 0,
  },
  text: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 17,
    lineHeight: 22,
    color: colors2024['neutral-title-1'],
    flexShrink: 1,
  },
  icon: { width: 26, height: 26, borderRadius: 1000, backgroundColor: 'white' },
  addressCaretIcon: { flexShrink: 0 },
  reverseCaret: { transform: [{ rotate: '180deg' }] },
  quoteColumn: { alignItems: 'flex-end', flexShrink: 0 },
  price: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 22,
    color: colors2024['neutral-title-1'],
  },
}));

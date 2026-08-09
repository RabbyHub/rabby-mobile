import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useLayoutEffect, useMemo } from 'react';
import { View } from 'react-native';

import { apiContact } from '@/core/apis';
import type { Account } from '@/core/startupServices/preference';
import { ellipsisAddress } from '@/utils/address';
import { usePerpsPopupState } from '../hooks/usePerpsPopupState';
import { HeaderBackPressable, useRabbyAppNavigation } from '@/hooks/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RcIconHyper from '@/assets2024/icons/perps/IconHyper.svg';
import { PerpsModeSwitch } from '../../PerpsShared/components/PerpsModeSwitch';
import { PerpsAccountTrigger } from '../../PerpsShared/components/PerpsAccountTrigger';

const HEADER_HEIGHT = 58;

/**
 * Extracted as a standalone component so React Navigation
 * re-renders it on prop changes instead of stale closures.
 */
const PerpsHeaderContent: React.FC<{
  account?: Account | null;
  isModeSwitching: boolean;
  onSwitchToPro: () => void;
}> = ({ account, isModeSwitching, onSwitchToPro }) => {
  const { styles } = useTheme2024({ getStyle });
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
          <PerpsModeSwitch
            activeMode="simple"
            disabled={isModeSwitching}
            onSelectMode={viewMode => {
              if (viewMode === 'pro') {
                onSwitchToPro();
              }
            }}
          />
        </View>

        {/* Right: account selector */}
        <View style={styles.headerRight}>
          {account ? (
            <View style={styles.accountSelectorContainer}>
              <PerpsAccountTrigger
                expanded={popupState.isShowLoginPopup}
                label={alias || ellipsisAddress(account.address)}
                onPress={() => {
                  setPopupState(prev => ({
                    ...prev,
                    isShowLoginPopup: !prev.isShowLoginPopup,
                  }));
                }}
              />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
};

export const PerpsNativeHeader: React.FC<{
  account?: Account | null;
  isModeSwitching: boolean;
  onSwitchToPro: () => void;
}> = ({ account, isModeSwitching, onSwitchToPro }) => {
  const { colors2024 } = useTheme2024({ getStyle });
  const navigation = useRabbyAppNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      // eslint-disable-next-line react/no-unstable-nested-components
      header: () => (
        <PerpsHeaderContent
          account={account}
          isModeSwitching={isModeSwitching}
          onSwitchToPro={onSwitchToPro}
        />
      ),
      headerStyle: {
        backgroundColor: colors2024['neutral-bg-1'],
      },
    });
  }, [account, colors2024, isModeSwitching, navigation, onSwitchToPro]);

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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
    gap: 12,
  },
  accountSelectorContainer: {
    alignItems: 'flex-end',
    flex: 1,
    justifyContent: 'flex-end',
  },
}));

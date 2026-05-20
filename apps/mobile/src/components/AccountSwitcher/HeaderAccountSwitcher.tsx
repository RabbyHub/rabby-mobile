import React, { useEffect, useMemo } from 'react';
import { StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native';

import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { apiContact } from '@/core/apis';
import {
  switchSceneCurrentAccount,
  usePreFetchBeforeEnterScene,
  useSceneAccountInfo,
} from '@/hooks/accountsSwitcher';
import { useTheme2024 } from '@/hooks/theme';
import { ellipsisAddress } from '@/utils/address';
import { createGetStyles2024 } from '@/utils/styles';
import { CaretArrowIconCC } from '@/components/Icons/CaretArrowIconCC';
import { Text } from '@/components/Typography';

import { AccountSwitcherAopProps, useAccountSceneVisible } from './hooks';

export function HeaderAccountSwitcher({
  forScene,
  disableSwitch = false,
  style,
}: AccountSwitcherAopProps<{
  disableSwitch?: boolean;
  style?: StyleProp<ViewStyle>;
}>) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { isVisible, toggleSceneVisible } = useAccountSceneVisible(forScene);
  const { preFetchData } = usePreFetchBeforeEnterScene();
  const { isSceneUsingAllAccounts, finalSceneCurrentAccount } =
    useSceneAccountInfo({
      forScene,
    });

  useEffect(() => {
    if (!isSceneUsingAllAccounts && finalSceneCurrentAccount) {
      switchSceneCurrentAccount(forScene, finalSceneCurrentAccount, {
        maybeReEntrant: true,
      });
    }
  }, [finalSceneCurrentAccount, forScene, isSceneUsingAllAccounts]);

  const accountName = useMemo(() => {
    if (!finalSceneCurrentAccount?.address) {
      return '';
    }

    return (
      finalSceneCurrentAccount.aliasName ||
      apiContact.getAliasName(finalSceneCurrentAccount.address) ||
      ellipsisAddress(finalSceneCurrentAccount.address)
    );
  }, [finalSceneCurrentAccount]);

  if (!finalSceneCurrentAccount) {
    return null;
  }

  return (
    <View style={[styles.accountSelectorContainer, style]}>
      <View style={styles.accountSelectorWidthLimiter}>
        <TouchableOpacity
          disabled={disableSwitch}
          style={styles.accountSelector}
          onPress={() => {
            const nextVisible = !isVisible;
            toggleSceneVisible(forScene, nextVisible);
            if (nextVisible) {
              preFetchData();
            }
          }}>
          <WalletIcon
            width={18}
            height={18}
            type={finalSceneCurrentAccount.brandName}
            address={finalSceneCurrentAccount.address}
          />
          <Text style={styles.accountName} numberOfLines={1}>
            {accountName}
          </Text>
          {!disableSwitch && (
            <CaretArrowIconCC
              dir="down"
              style={isVisible ? styles.reverseCaret : null}
              width={18}
              height={18}
              bgColor={colors2024['neutral-bg-5']}
              lineColor={colors2024['neutral-title-1']}
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  accountSelectorContainer: {
    flexShrink: 1,
    minWidth: 0,
  },
  accountSelectorWidthLimiter: {
    width: '100%',
    maxWidth: 160,
    alignSelf: 'flex-end',
  },
  accountSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: '100%',
    backgroundColor: colors2024['neutral-bg-5'],
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
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

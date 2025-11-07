import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  AccountSwitcherAopProps,
  useAccountSceneVisible,
} from '@/components/AccountSwitcher/hooks';
import {
  useSceneAccountInfo,
  useSwitchSceneCurrentAccount,
  usePreFetchBeforeEnterScene,
} from '@/hooks/accountsSwitcher';
import { ellipsisAddress } from '@/utils/address';
import useMount from 'react-use/lib/useMount';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { CaretArrowIconCC } from '@/components/Icons/CaretArrowIconCC';

function AccountSwitcherComponent({
  forScene = 'TokenDetail',
  disableSwitch = false,
}: RNViewProps &
  AccountSwitcherAopProps<{
    disableSwitch?: boolean;
  }>) {
  const { colors2024, styles } = useTheme2024({ getStyle });

  const { isVisible: isOpen, toggleSceneVisible } =
    useAccountSceneVisible(forScene);
  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();
  const { isSceneUsingAllAccounts, finalSceneCurrentAccount } =
    useSceneAccountInfo({
      forScene,
    });

  const { preFetchData } = usePreFetchBeforeEnterScene();

  useMount(() => {
    if (!isSceneUsingAllAccounts) {
      switchSceneCurrentAccount(forScene, finalSceneCurrentAccount, {
        maybeReEntrant: true,
      });
    }
  });

  return (
    <Pressable
      style={styles.container}
      disabled={disableSwitch}
      onPress={() => {
        const nextOpen = !isOpen;
        toggleSceneVisible(forScene, nextOpen);
        if (nextOpen) {
          preFetchData();
        }
      }}>
      {!!finalSceneCurrentAccount && (
        <AddressItem account={finalSceneCurrentAccount}>
          {({ WalletIcon }) => {
            return (
              <View style={styles.addressRow}>
                <WalletIcon style={styles.walletIcon} />
                <Text style={styles.address}>
                  {finalSceneCurrentAccount.aliasName ||
                    ellipsisAddress(finalSceneCurrentAccount?.address)}
                </Text>
              </View>
            );
          }}
        </AddressItem>
      )}
      {!disableSwitch && (
        <CaretArrowIconCC
          dir={!isOpen ? 'down' : 'down'}
          style={[styles.addressCaretIcon]}
          width={20}
          height={20}
          bgColor="transparent"
          lineColor={colors2024['neutral-foot']}
        />
      )}
    </Pressable>
  );
}

export const AccountSwitcher = memo(AccountSwitcherComponent);

const getStyle = createGetStyles2024(ctx => {
  return {
    container: {
      borderRadius: 6,
      padding: 6,
      backgroundColor: ctx.colors2024['neutral-bg-5'],
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      marginBottom: 12,
    },
    titleText: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '800',
      lineHeight: 24,
      fontSize: 20,
      color: ctx.colors2024['neutral-title-1'],
    },
    addressRow: {
      flexDirection: 'row',
      // width: '100%',
      alignItems: 'center',
    },
    walletIcon: {
      borderRadius: 5,
      width: 18,
      height: 18,
      marginRight: 8,
    },
    address: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      lineHeight: 20,
      fontSize: 16,
      color: ctx.colors2024['neutral-body'],
    },
    addressCaretIcon: {
      marginLeft: 0,
    },
    reverseCaret: {
      // transform: [{ rotate: '180deg' }],
    },
  };
});

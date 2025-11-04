import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { memo } from 'react';
import { Text, View } from 'react-native';

import TouchableView from '../Touchable/TouchableView';
import { AccountSwitcherAopProps, useAccountSceneVisible } from './hooks';
import {
  useSceneAccountInfo,
  useSwitchSceneCurrentAccount,
  usePreFetchBeforeEnterScene,
} from '@/hooks/accountsSwitcher';
import { ellipsisAddress } from '@/utils/address';
import useMount from 'react-use/lib/useMount';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { CaretArrowIconCC } from '../Icons/CaretArrowIconCC';

function AccountSwitcherComponent({
  forScene,
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
    <TouchableView
      style={styles.container}
      disabled={disableSwitch}
      onPress={() => {
        const nextOpen = !isOpen;
        toggleSceneVisible(forScene, nextOpen);
        if (nextOpen) {
          preFetchData();
        }
      }}>
      <View style={styles.addressRow}>
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
            dir={!isOpen ? 'right' : 'down'}
            style={[styles.addressCaretIcon]}
            width={26}
            height={26}
            bgColor={colors2024['neutral-line']}
            lineColor={colors2024['neutral-title-1']}
          />
        )}
      </View>
    </TouchableView>
  );
}

export const AccountSwitcher = memo(AccountSwitcherComponent);

const getStyle = createGetStyles2024(ctx => {
  return {
    container: {
      borderRadius: 16,
      paddingHorizontal: 22,
      paddingVertical: 16,
      backgroundColor: ctx.colors2024['neutral-bg-2'],
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
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
      width: '100%',
      alignItems: 'center',
    },
    walletIcon: {
      borderRadius: 7,
      width: 24,
      height: 24,
      marginRight: 8,
    },
    address: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      lineHeight: 20,
      fontSize: 16,
      color: ctx.colors2024['neutral-title-1'],
    },
    addressCaretIcon: {
      marginLeft: 'auto',
    },
    reverseCaret: {
      // transform: [{ rotate: '180deg' }],
    },
  };
});

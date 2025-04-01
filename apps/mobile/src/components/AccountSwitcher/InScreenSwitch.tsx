import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { memo, useMemo } from 'react';
import { Text, View } from 'react-native';

import { CaretDownIconCC } from './icons/CaretDownIconCC';
import TouchableView from '../Touchable/TouchableView';
import { AccountSwitcherAopProps, useAccountSceneVisible } from './hooks';
import {
  useSceneAccountInfo,
  useSwitchSceneCurrentAccount,
  usePreFetchBeforeEnterScene,
} from '@/hooks/accountsSwitcher';
import { ellipsisAddress } from '@/utils/address';
import { useTranslation } from 'react-i18next';
import useMount from 'react-use/lib/useMount';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';

function AccountSwitcherComponent({
  forScene,
  disableSwitch = false,
}: RNViewProps &
  AccountSwitcherAopProps<{
    disableSwitch?: boolean;
  }>) {
  const { colors2024, styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const { isVisible: isOpen, toggleSceneVisible } =
    useAccountSceneVisible(forScene);
  const { switchSceneCurrentAccount, toggleUseAllAccountsOnScene } =
    useSwitchSceneCurrentAccount();
  const {
    isSceneSupportAllAccounts,
    isSceneUsingAllAccounts,
    finalSceneCurrentAccount,
    myAddresses,
  } = useSceneAccountInfo({
    forScene,
  });

  const { preFetchData } = usePreFetchBeforeEnterScene();

  useMount(() => {
    if (!isSceneUsingAllAccounts) {
      switchSceneCurrentAccount(forScene, finalSceneCurrentAccount, {
        maybeReEntrant: true,
      });
    }

    if (isSceneSupportAllAccounts) {
      toggleUseAllAccountsOnScene(forScene, true);
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
        {!isSceneUsingAllAccounts ? (
          !!finalSceneCurrentAccount && (
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
          )
        ) : (
          <Text style={styles.address}>
            {t('component.accountSwitcher.all')}{' '}
            {t('component.accountSwitcher.screenHeaderSubTitle', {
              count: myAddresses.length,
            })}
          </Text>
        )}
        {!disableSwitch && (
          <CaretDownIconCC
            style={[styles.addressCaretIcon, isOpen && styles.reverseCaret]}
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
      transform: [{ rotate: '180deg' }],
    },
  };
});

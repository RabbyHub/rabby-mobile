import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

// caret-down-cc.svg
import { default as RcCaretDownCircleCC } from './icons/caret-down-circle.svg';
import { default as RcCaretDownCircleDarkCC } from './icons/caret-down-circle-dark.svg';
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
import { useRendererDetect } from '../Perf/PerfDetector';

export function ScreenHeaderAccountSwitcher({
  titleText = '',
  forScene,
  disableSwitch = false,
}: RNViewProps &
  AccountSwitcherAopProps<{
    titleText?: React.ReactNode;
    disableSwitch?: boolean;
  }>) {
  const { colors2024, styles, isLight } = useTheme2024({ getStyle });
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

  useRendererDetect({ name: 'ScreenHeaderAccountSwitcher' });

  const { preFetchData } = usePreFetchBeforeEnterScene();

  const titleTextNode = useMemo(() => {
    return typeof titleText === 'string' ? (
      <Text style={styles.titleText}>{titleText}</Text>
    ) : (
      titleText
    );
  }, [titleText, styles]);

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

  const len = useMemo(() => {
    return myAddresses.length > 10 ? 10 : myAddresses.length;
  }, [myAddresses]);

  const IconCom = isLight ? RcCaretDownCircleCC : RcCaretDownCircleDarkCC;

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
      {titleTextNode}
      <View style={styles.addressRow}>
        {!isSceneUsingAllAccounts ? (
          !!finalSceneCurrentAccount && (
            <AddressItem account={finalSceneCurrentAccount}>
              {({ WalletIcon, WalletAddress }) => {
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
              count: len,
            })}
          </Text>
        )}
        {!disableSwitch && (
          <IconCom
            style={[styles.addressCaretIcon, isOpen && styles.reverseCaret]}
            width={18}
            height={18}
            color={colors2024['neutral-bg-4']}
          />
        )}
      </View>
    </TouchableView>
  );
}

const getStyle = createGetStyles2024(ctx => {
  return {
    container: {
      // ...makeDebugBorder('blue'),
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 199,
      marginTop: -4,
    },
    titleText: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '900',
      lineHeight: 24,
      fontSize: 20,
      color: ctx.colors2024['neutral-title-1'],
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    walletIcon: {
      borderRadius: 4,
      width: 18,
      height: 18,
      marginRight: 4,
    },
    address: {
      margin: 4,
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      lineHeight: 20,
      fontSize: 16,
      color: ctx.colors2024['neutral-foot'],
    },
    addressCaretIcon: {
      marginLeft: 4,
    },
    reverseCaret: {
      transform: [{ rotate: '180deg' }],
    },
  };
});

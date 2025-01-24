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
            <Text style={styles.address}>
              {finalSceneCurrentAccount.aliasName ||
                ellipsisAddress(finalSceneCurrentAccount?.address)}
            </Text>
          )
        ) : (
          <Text style={styles.address}>
            {t('component.accountSwitcher.screenHeaderSubTitle', {
              count: myAddresses.length,
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
      fontWeight: '800',
      lineHeight: 24,
      fontSize: 20,
      color: ctx.colors2024['neutral-title-1'],
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    address: {
      margin: 4,
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      lineHeight: 22,
      fontSize: 17,
      color: ctx.colors2024['brand-default'],
    },
    addressCaretIcon: {
      marginLeft: 4,
    },
    reverseCaret: {
      transform: [{ rotate: '180deg' }],
    },
  };
});

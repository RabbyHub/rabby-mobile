import { FontNames } from '@/core/utils/fonts';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';

// caret-down-cc.svg
import { default as RcCaretDownCircleCC } from './icons/caret-down-circle-cc.svg';
import { default as RcCaretDownCircleDarkCC } from './icons/caret-down-circle-dark-cc.svg';
import TouchableView from '../Touchable/TouchableView';
import { AccountSwitcherAopProps, useAccountSceneVisible } from './hooks';
import {
  useSceneAccountInfo,
  useSwitchSceneCurrentAccount,
  useSwitchAccountBeforeEnterScene,
} from '@/hooks/accountsSwitcher';
import { ellipsisAddress } from '@/utils/address';
import { useTranslation } from 'react-i18next';

export function ScreenHeaderAccountSwitcher({
  titleText = '',
  forScene,
}: RNViewProps &
  AccountSwitcherAopProps<{
    titleText?: React.ReactNode;
  }>) {
  const { colors2024, styles, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const { isVisible: isOpen, toggleSceneVisible } =
    useAccountSceneVisible(forScene);
  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();
  const { isSceneUsingAllAccounts, finalSceneCurrentAccount, myAddresses } =
    useSceneAccountInfo({
      forScene,
    });
  const { preFetchData } = useSwitchAccountBeforeEnterScene();

  const titleTextNode = useMemo(() => {
    return typeof titleText === 'string' ? (
      <Text style={styles.titleText}>{titleText}</Text>
    ) : (
      titleText
    );
  }, [titleText, styles]);

  useEffect(() => {
    switchSceneCurrentAccount(forScene, finalSceneCurrentAccount, {
      maybeReEntrant: true,
    });
  }, [finalSceneCurrentAccount, forScene, switchSceneCurrentAccount]);

  const needShowPicker = !!myAddresses.length;
  if (!isSceneUsingAllAccounts && !finalSceneCurrentAccount?.address) {
    return titleTextNode;
  } else if (isSceneUsingAllAccounts && !needShowPicker) {
    return titleTextNode;
  }

  const IconCom = isLight ? RcCaretDownCircleCC : RcCaretDownCircleDarkCC;

  return (
    <TouchableView
      style={styles.container}
      onPress={() => {
        const nextOpen = !isOpen;
        toggleSceneVisible(forScene, nextOpen);
        if (nextOpen) {
          preFetchData();
        }
      }}>
      {titleTextNode}
      <View style={styles.addressRow}>
        {!isSceneUsingAllAccounts
          ? !!finalSceneCurrentAccount?.address && (
              <Text style={styles.address}>
                {ellipsisAddress(finalSceneCurrentAccount?.address)}
              </Text>
            )
          : needShowPicker && (
              <Text style={styles.address}>
                {t('component.accountSwitcher.screenHeaderSubTitle', {
                  count: myAddresses.length,
                })}
              </Text>
            )}
        <IconCom
          style={[styles.addressCaretIcon, isOpen && styles.reverseCaret]}
          width={18}
          height={18}
          color={colors2024['neutral-bg-4']}
        />
      </View>
    </TouchableView>
  );
}

/** @deprecated */
export function ScreenHeaderAccountPicker({
  titleText = '',
  forScene,
}: RNViewProps &
  AccountSwitcherAopProps<{
    titleText?: React.ReactNode;
  }>) {
  const { colors2024, styles } = useTheme2024({ getStyle });

  const { isVisible: isOpen, toggleSceneVisible } =
    useAccountSceneVisible(forScene);
  const { totalCountOfAccount, myAddresses } = useSceneAccountInfo({
    forScene,
  });
  const { preFetchData } = useSwitchAccountBeforeEnterScene();

  const titleTextNode = useMemo(() => {
    return typeof titleText === 'string' ? (
      <Text style={styles.titleText}>{titleText}</Text>
    ) : (
      titleText
    );
  }, [titleText, styles]);

  const needShowPicker = totalCountOfAccount > 1 && !!myAddresses.length;
  if (!needShowPicker) {
    return titleTextNode;
  }

  return (
    <TouchableView
      style={styles.container}
      onPress={() => {
        const nextOpen = !isOpen;
        toggleSceneVisible(forScene, nextOpen);
        if (nextOpen) {
          preFetchData();
        }
      }}>
      {titleTextNode}
      {needShowPicker && (
        <View style={styles.addressRow}>
          <Text style={styles.address}>
            {Math.max(myAddresses.length, 0)} addresses
          </Text>

          <RcCaretDownCircleCC
            style={[styles.addressCaretIcon, isOpen && styles.reverseCaret]}
            width={18}
            height={18}
            color={colors2024['neutral-bg-4']}
          />
        </View>
      )}
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

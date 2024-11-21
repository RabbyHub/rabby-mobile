import { FontNames } from '@/core/utils/fonts';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

// caret-down-cc.svg
import { default as RcCaretDownCircleCC } from './icons/caret-down-circle-cc.svg';
import TouchableView from '../Touchable/TouchableView';
import {
  AccountSwitcherAopProps,
  AccountSwitcherScene,
  useAccountSwitcherScenes,
} from './hooks';
import {
  useSceneCurrentAccount,
  useSwitchAccountBeforeEnterScene,
} from '@/hooks/accountsSwitcher';
import { ellipsisAddress } from '@/utils/address';

export function ScreenHeaderAccountSwitcher({
  titleText = '',
  forScene,
}: RNViewProps &
  AccountSwitcherAopProps<{
    titleText?: React.ReactNode;
  }>) {
  const { colors2024, styles } = useTheme2024({ getStyle });

  const { isVisible: isOpen, toggleSceneVisible } =
    useAccountSwitcherScenes(forScene);
  const { sceneCurrentAccount } = useSceneCurrentAccount(forScene);
  const { preFetchData } = useSwitchAccountBeforeEnterScene();

  const titleTextNode = useMemo(() => {
    return typeof titleText === 'string' ? (
      <Text style={styles.titleText}>{titleText}</Text>
    ) : (
      titleText
    );
  }, [titleText, styles]);

  // const isOpen = getSceneVisible(forScene);

  if (!sceneCurrentAccount?.address) {
    return titleTextNode;
  }

  return (
    <View style={styles.container}>
      {titleTextNode}
      {!!sceneCurrentAccount?.address && (
        <TouchableView
          style={styles.addressRow}
          onPress={() => {
            const nextOpen = !isOpen;
            toggleSceneVisible(forScene, nextOpen);
            if (nextOpen) {
              preFetchData();
            }
          }}>
          <Text style={styles.address}>
            {ellipsisAddress(sceneCurrentAccount?.address)}
          </Text>

          <RcCaretDownCircleCC
            style={[styles.addressCaretIcon, isOpen && styles.reverseCaret]}
            width={18}
            height={18}
            color={colors2024['neutral-bg-4']}
          />
        </TouchableView>
      )}
    </View>
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
      color: ctx.colors2024['neutral-secondary'],
    },
    addressCaretIcon: {
      marginLeft: 4,
    },
    reverseCaret: {
      transform: [{ rotate: '180deg' }],
    },
  };
});

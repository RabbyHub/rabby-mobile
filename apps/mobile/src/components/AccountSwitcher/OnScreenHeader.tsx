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

export function ScreenHeaderAccountSwitcher({
  titleText = '',
  forScene,
}: RNViewProps &
  AccountSwitcherAopProps<{
    titleText?: React.ReactNode;
  }>) {
  const { colors2024, styles } = useTheme2024({ getStyle });

  const { getSceneVisible, toggleSceneVisible } = useAccountSwitcherScenes();

  const titleTextNode = useMemo(() => {
    return typeof titleText === 'string' ? (
      <Text style={styles.titleText}>{titleText}</Text>
    ) : (
      titleText
    );
  }, [titleText, styles]);

  const isOpen = getSceneVisible(forScene);

  return (
    <View style={styles.container}>
      {titleTextNode}
      <TouchableView
        style={styles.addressRow}
        onPress={() => {
          toggleSceneVisible(forScene, !isOpen);
        }}>
        <Text style={styles.address}>{'0x1234567890'}</Text>

        <RcCaretDownCircleCC
          style={[styles.addressCaretIcon, isOpen && styles.reverseCaret]}
          width={18}
          height={18}
          color={colors2024['neutral-bg-4']}
        />
      </TouchableView>
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

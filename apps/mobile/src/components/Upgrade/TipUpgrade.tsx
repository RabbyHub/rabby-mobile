import { View, Text } from 'react-native';
import { BottomSheetView } from '@gorhom/bottom-sheet';

import { useThemeStyles } from '@/hooks/theme';
import { useUpgradeInfo } from '@/hooks/version';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';

import FooterComponentForUpgrade from './FooterComponentForUpgrade';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { MarkdownInWebView } from '../Markdown/InWebView';
import AutoLockView from '../AutoLockView';

// const DEMO_CHANGELOG = `
// ### New features

// 1. Support the Celo chain
// 2. Support the built-in “Send Token” & “Contacts” feature

// ### Important bug fixes

// 1. Fix issue: “Fail to import mnemonic words under certain scenarios”
// `;

export function TipUpgradeModalInner() {
  const { styles } = useThemeStyles(getStyles);

  const { remoteVersion } = useUpgradeInfo();

  const { safeOffBottom } = useSafeSizes();

  return (
    <AutoLockView
      as="BottomSheetView"
      style={[styles.container, { paddingBottom: safeOffBottom }]}>
      <View style={styles.topContainer}>
        <View style={styles.titleArea}>
          <Text style={styles.title}>New Version</Text>
          <Text style={styles.subTitle}>{remoteVersion.version}</Text>
        </View>
        <View
          // contentInsetAdjustmentBehavior="automatic"
          style={[styles.bodyTextScrollerContainer]}>
          <MarkdownInWebView markdown={remoteVersion.changelog} />
        </View>
      </View>
      <FooterComponentForUpgrade style={[styles.footerComponent]} />
    </AutoLockView>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    container: {
      flexDirection: 'column',
      position: 'relative',
      height: '100%',
      // ...makeDebugBorder('blue'),
    },

    topContainer: {
      paddingTop: 20,
      height: '100%',
      flexShrink: 1,
      // ...makeDebugBorder('green'),
    },

    // innerBlock: {
    //   paddingHorizontal: 20,
    // },

    titleArea: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      marginBottom: 12,
    },

    title: {
      color: colors['neutral-title1'],
      textAlign: 'center',
      fontSize: 24,
      fontWeight: '600',
    },

    subTitle: {
      color: colors['neutral-body'],
      textAlign: 'center',
      fontSize: 14,
      fontWeight: '400',
      marginTop: 12,
    },

    bodyTextScrollerContainer: {
      flexShrink: 2,
      height: '100%',
      // ...makeDebugBorder('red'),
    },

    footerComponent: {
      height: 100,
      flexShrink: 0,
      // ...makeDebugBorder('yellow'),
    },
  };
});

import React from 'react';
import { View, Text } from 'react-native';
import { BottomSheetView } from '@gorhom/bottom-sheet';

import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';

// import FooterComponentForUpgrade from './FooterComponentForUpgrade';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { MarkdownInWebView } from '@/components/Markdown/InWebView';

import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import AutoLockView from '@/components/AutoLockView';
import { TermOfUseMarkdown } from '@/screens/ManagePassword/components/TermOfUseMarkdown';

export function useShowMarkdownInWebVIewTester() {
  const openedModalIdRef = React.useRef<string>('');
  const viewMarkdownInWebView = React.useCallback(() => {
    openedModalIdRef.current = createGlobalBottomSheetModal({
      name: MODAL_NAMES.__TEST_MARKDOWN_IN_WEBVIEW,
      title: '',
      bottomSheetModalProps: {
        onDismiss: () => {
          removeGlobalBottomSheetModal(openedModalIdRef.current);
          openedModalIdRef.current = '';
        },
      },
    });
  }, []);

  return {
    viewMarkdownInWebView,
  };
}

const HTML_INNER_STYLE = `
h1 { font-size: 22px; }
h2 { font-size: 18px; }
h3 { font-size: 16px; }
h4 { font-size: 14px; }
h5 { font-size: 13px; }
h6 { font-size: 12px; }
h1 + h2 {
  margin-top: 8px;
}
p {
  line-height: 18px;
}
`;

export function MarkdownInWebViewInner() {
  const { styles } = useThemeStyles(getStyles);

  const { safeOffBottom } = useSafeSizes();

  return (
    <AutoLockView
      as="BottomSheetView"
      style={[styles.container, { paddingBottom: safeOffBottom }]}>
      <View style={styles.topContainer}>
        {/* <View style={styles.titleArea}>
          <Text style={styles.title}>New Version</Text>
          <Text style={styles.subTitle}>{remoteVersion.version}</Text>
        </View> */}
        <View style={[styles.bodyTextScrollerContainer]}>
          <MarkdownInWebView
            markdown={TermOfUseMarkdown}
            htmlInnerStyle={HTML_INNER_STYLE}
          />
        </View>
      </View>
      {/* <FooterComponentForUpgrade style={[styles.footerComponent]} /> */}
    </AutoLockView>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    container: {
      flexDirection: 'column',
      position: 'relative',
      height: '100%',
    },

    topContainer: {
      paddingTop: 20,
      height: '100%',
      flexShrink: 1,
    },

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
    },

    footerComponent: {
      height: 100,
      flexShrink: 0,
    },
  };
});

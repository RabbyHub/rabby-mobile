import React from 'react';
import { View } from 'react-native';

import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';

// import FooterComponentForUpgrade from './FooterComponentForUpgrade';
import { useSafeSizes } from '@/hooks/useAppLayout';

import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';

import AutoLockView from '@/components/AutoLockView';
import WebView from 'react-native-webview';
import { APP_UA_PARIALS } from '@/constant';
import { checkShouldStartLoadingWithRequestForTrustedContent } from '@/components/WebView/utils';

export function useShowUserAgreementLikeModal() {
  const openedModalIdRef = React.useRef<string>('');
  const viewTermsOfUse = React.useCallback(() => {
    openedModalIdRef.current = createGlobalBottomSheetModal({
      name: MODAL_NAMES.TIP_TERM_OF_USE,
      title: '',
      bottomSheetModalProps: {
        onDismiss: () => {
          removeGlobalBottomSheetModal(openedModalIdRef.current);
          openedModalIdRef.current = '';
        },
      },
    });
  }, []);

  const openedModal2IdRef = React.useRef<string>('');
  const viewPrivacyPolicy = React.useCallback(() => {
    openedModal2IdRef.current = createGlobalBottomSheetModal({
      name: MODAL_NAMES.TIP_PRIVACY_POLICY,
      title: '',
      bottomSheetModalProps: {
        onDismiss: () => {
          removeGlobalBottomSheetModal(openedModal2IdRef.current);
          openedModal2IdRef.current = '';
        },
      },
    });
  }, []);

  return {
    viewPrivacyPolicy,
    viewTermsOfUse,
  };
}

const HTML_INNER_STYLE = `
html, body {
  margin: 0;
}
ul { padding-left: 14px; }
ul li, ol li { padding-left: 0; }
.md-wrapper {
  padding-left: 20px;
  padding-right: 20px;
}
h1 { font-size: 18px; }
h2 { font-size: 14px; }
h3 { font-size: 14px; }
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

export function UserAgreementLikeModalInner({ uri }: { uri: string }) {
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
        <View style={[styles.bodyScrollerContainer]}>
          <WebView
            style={styles.webviewInst}
            cacheEnabled
            startInLoadingState
            allowsFullscreenVideo={false}
            allowsInlineMediaPlayback={false}
            originWhitelist={['https://debank.com', 'https://rabby.io']}
            applicationNameForUserAgent={APP_UA_PARIALS.UA_FULL_NAME}
            javaScriptEnabled
            nestedScrollEnabled
            source={{ uri }}
            onShouldStartLoadWithRequest={nativeEvent => {
              // always allow first time loading
              if (!nativeEvent.canGoBack) return true;
              return checkShouldStartLoadingWithRequestForTrustedContent(
                nativeEvent,
              );
            }}
          />
        </View>
      </View>
      {/* <FooterComponentForUpgrade style={[styles.footerComponent]} /> */}
    </AutoLockView>
  );
}

export function TipPrivacyPolicyInner() {
  return <UserAgreementLikeModalInner uri={'https://rabby.io/docs/privacy'} />;
}

export function TipTermOfUseModalInner() {
  return (
    <UserAgreementLikeModalInner uri={'https://rabby.io/docs/terms-of-use'} />
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
      paddingTop: 8,
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

    bodyScrollerContainer: {
      flexShrink: 2,
      height: '100%',
    },

    webviewInst: {
      width: '100%',
      height: '100%',
    },

    footerComponent: {
      height: 100,
      flexShrink: 0,
    },
  };
});

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

const markdownContent = `
# Rabby Terms of Service and Privacy Policy
## Last updated: November 11, 2022
DEBANK GLOBAL PTE. LTD. ("DEBANK" or "Rabby" or "we") respects and protects the privacy of Users (“you” or “users”). We will collect and use the information generated from your use of DeBank or Rabby, in accordance with the Terms of Use.

## What information do we collect
We get information about you in a range of ways.

Information You Give Us. Information we collect from you includes:
- Network information regarding transactions;
- Feedback and correspondence, such as information you provide in your responses to surveys when you report a problem with our service, receive customer support, or otherwise correspond with us;
- Usage information, such as information about how you use the Service and interact with us;

## We will never collect the following information:
- Never collect keys, addresses, transactions, balances, hashes, or any personal information
- Never collect your full IP address
- Never sell data for profit

## How do we use the information we collect
Our primary purpose in collecting information is to help us operate, provide, improve, customize, support, and market our services.

We may use your information to:
- Provide the services and customer support you request;
- Resolve disputes and troubleshoot problems;

## How do we use Cookies
When you access our services, we may place small data files called cookies or pixel tags on your computer.

We use these files to understand, secure, operate, and provide our services. For example, we use cookies to:
- Provide all web-based services, improve your experience, and understand how our services are being used;
- Remember your choices and customize our services for you

## How do we update our policy
We reserve the right to update this Policy online from time to time, and the new policy will immediately replace the older one once posted.

For material changes to this policy, we will update the "last updated date" at the top of this page.

In particular, if you do not accept the revised policies, please immediately stop your use of DeBank or Rabby.

Your continued use of our services confirms your acceptance of our terms of use, as amended. If you do not agree to our terms of use, as amended, you must stop using our services.

## Contact Us
If you have any questions about our terms of use, please contact us at hi@debank.com.
`;

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
            markdown={markdownContent}
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

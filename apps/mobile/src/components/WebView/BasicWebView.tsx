import React, {
  useMemo,
  useCallback,
  useRef,
  useImperativeHandle,
  forwardRef,
} from 'react';
import {
  WebView,
  WebViewMessageEvent,
  WebViewProps,
} from 'react-native-webview';
import { StyleSheet } from 'react-native';
import { devLog } from '@/utils/logger';

function log(...info: any) {
  devLog('[BasicWebView::info]', ...info);
}

interface IWebviewProps {
  source: string;
  reload?: () => void;
  onWebviewMessage?: (data: IMessageData) => void;
  isShown?: boolean;
}

interface IMessageData {
  path: String;
  data: any;
}

// webview docs: https://github.com/react-native-webview/react-native-webview/blob/master/docs/Guide.md#basic-url-source
const BasicWebView: Parameters<
  typeof forwardRef<WebView, Omit<WebViewProps, 'source'> & IWebviewProps>
>[0] = (props, ref) => {
  const { source, onWebviewMessage, isShown = true, ...restProps } = props;

  const webviewRef = useRef<WebView>(null);

  const onMessage = useCallback(
    (messageEvent: WebViewMessageEvent) => {
      const message = messageEvent.nativeEvent.data;
      log('[Webview -> RN]', message);
      const data = JSON.parse(message) as IMessageData;
      if (onWebviewMessage) {
        onWebviewMessage(data);
      }
    },
    [onWebviewMessage],
  );

  const sendMessage = useCallback(
    (path: IMessageData['path'], data: IMessageData['data']) => {
      const message: IMessageData = {
        path,
        data,
      };
      log('[RN -> Webview]', message);
      const serializeData = JSON.stringify(message);
      if (webviewRef?.current?.postMessage) {
        webviewRef.current.postMessage(serializeData);
      }
    },
    [webviewRef],
  );

  // FIXME: not all fields are exposed
  // @ts-expect-error we know it
  useImperativeHandle(ref, () => ({
    sendMessage,
  }));

  const styles = getStyle();

  return (
    <WebView
      {...restProps}
      style={[restProps.style, styles.basic, !isShown && styles.hidden]}
      ref={webviewRef}
      source={{ uri: source }}
      onMessage={onMessage}
    />
  );
};

const getStyle = () =>
  StyleSheet.create({
    basic: {
      height: '100%',
      width: '100%',
      opacity: 1,
      overflow: 'hidden',
    },
    hidden: {
      height: 0,
      width: 0,
      opacity: 0,
      overflow: 'hidden',
    },
  });

export default forwardRef(BasicWebView);

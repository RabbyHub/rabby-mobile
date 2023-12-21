import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Dimensions, ViewProps } from 'react-native';
import WebView from 'react-native-webview';

import { stringUtils, urlUtils } from '@rabby-wallet/base-utils';

import { Text } from '../Text';

import { ScreenLayouts } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';

import ChainIconImage from '../Chain/ChainIconImage';

import SampleChainIconTPSource from './icons/sample-chain-icon-tp.png';
import { RcIconMore } from './icons';
import TouchableItem from '../Touchable/TouchableItem';
import BasicWebView from './BasicWebView';
import { devLog } from '@/utils/logger';

function errorLog(...info: any) {
  devLog('[DappWebViewControl::error]', ...info);
}

function DappWebViewHead({
  dappId,
  currentUrl,
  ...props
}: ViewProps & {
  dappId: string;
  currentUrl?: string | null;
}) {
  const colors = useThemeColors();

  const { subTitle } = useMemo(() => {
    return {
      subTitle: currentUrl
        ? urlUtils.canoicalizeDappUrl(currentUrl).httpOrigin
        : stringUtils.ensurePrefix(dappId, 'https://'),
    };
  }, [dappId, currentUrl]);

  return (
    <View {...props} style={[styles.dappWebViewHeadContainer, props.style]}>
      <View style={[styles.leftWrapper]}>
        <ChainIconImage
          source={SampleChainIconTPSource}
          size={24}
          width={24}
          height={24}
        />
      </View>
      <View
        style={styles.DappWebViewHeadTitleWrapper}
        // {...panDownGestureHandlers}
      >
        {/* origin */}
        <Text
          style={{
            ...styles.HeadTitleOrigin,
            color: colors['neutral-title-1'],
          }}>
          {dappId}
        </Text>

        {/* main domain */}
        <Text
          style={{
            ...styles.HeadTitleMainDomain,
            color: colors['neutral-foot'],
          }}>
          {subTitle}
        </Text>
      </View>
      <View style={[styles.rightWrapper]}>
        <TouchableItem
          onPress={() => {
            // TODO: show webview menu on another bottom sheet modal
          }}>
          <RcIconMore width={24} height={24} />
        </TouchableItem>
      </View>
    </View>
  );
}

function DappWebViewControl({ dappId }: { dappId: string }) {
  const colors = useThemeColors();

  const localWebviewRef = useRef<WebView>(null);

  const [latestUrl, setLatestUrl] = useState<string | null>(null);

  return (
    <View
      style={[
        styles.dappWebViewControl,
        {
          backgroundColor: colors['neutral-bg-1'],
        },
      ]}>
      <DappWebViewHead
        dappId={dappId}
        currentUrl={latestUrl}
        style={{ flexShrink: 0 }}
      />

      {/* webvbiew */}
      <View style={[styles.dappWebViewContainer]}>
        <BasicWebView
          ref={localWebviewRef}
          source={stringUtils.ensurePrefix(dappId, 'https://')}
          onNavigationStateChange={newNavState => {
            const { url } = newNavState;

            setLatestUrl(url);
            if (!url) {
              return;
            }
          }}
          onError={errorLog}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dappWebViewControl: {
    width: '100%',
    paddingVertical: 10,
  },
  dappWebViewHeadContainer: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: Dimensions.get('window').width,
    height: ScreenLayouts.dappWebViewControlHeaderHeight,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  leftWrapper: {},
  rightWrapper: {},
  DappWebViewHeadTitleWrapper: {
    flexDirection: 'column',
  },
  HeadTitleOrigin: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  HeadTitleMainDomain: {
    fontSize: 11,
    fontWeight: '400',
    textAlign: 'center',
  },

  dappWebViewContainer: {
    flexShrink: 1,
    height: '100%',
  },
});

export default DappWebViewControl;

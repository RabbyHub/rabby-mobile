import { StyleSheet, View, Dimensions, ViewProps } from 'react-native';
import { Text } from '../Text';

import { ScreenLayouts } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';
import { TouchableOpacity } from 'react-native-gesture-handler';

import ChainIconImage from '../Chain/ChainIconImage';

import SampleChainIconTPSource from './icons/sample-chain-icon-tp.png';
import { RcIconMore } from './icons';
import TouchableItem from '../Touchable/TouchableItem';
import BasicWebView from './BasicWebView';
import { useGestureEventsHandlersDefault } from '@gorhom/bottom-sheet';

function DappWebViewHead({ ...props }: ViewProps) {
  const colors = useThemeColors();

  const panDownGestureHandlers = useGestureEventsHandlersDefault();

  return (
    <View {...props} style={[styles.dappWebViewHeadContainer, props.style]}>
      <View style={[styles.leftWrapper]}>
        <ChainIconImage
          source={SampleChainIconTPSource}
          size={24}
          width={24}
          height={24}
        />
        {/* <Text>
          <RcSampleChainIconTP />
        </Text> */}
      </View>
      <View
        style={styles.DappWebViewHeadTitleWrapper}
        {...panDownGestureHandlers}>
        {/* origin */}
        <Text
          style={{
            ...styles.HeadTitleOrigin,
            color: colors['neutral-title-1'],
          }}>
          app.uniswap.org
        </Text>

        {/* main domain */}
        <Text
          style={{
            ...styles.HeadTitleMainDomain,
            color: colors['neutral-foot'],
          }}>
          https://uniswap.org
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

export default function DappWebViewControl() {
  const colors = useThemeColors();

  return (
    <View
      style={[
        styles.dappWebViewControl,
        {
          backgroundColor: colors['neutral-bg-1'],
        },
      ]}>
      <DappWebViewHead style={{ flexShrink: 0 }} />

      {/* webvbiew */}
      <View style={[styles.dappWebViewContainer]}>
        <BasicWebView
          // source={'https://app.uniswap.org'}
          source={'https://baidu.com'}
          isShown
          onTouchStart={evt => {
            evt.preventDefault();
            evt.stopPropagation();
          }}
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

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useInnerDappPreloadStrategy } from '@/config/innerDappPreloadStrategy';
import InnerDappWebViewPreloadLayer from '@/components/WebView/InnerDappWebViewPreloadLayer';
import AAVEScreen from '@/screens/Lending/Entry';
import { PerpsScreen } from '@/screens/Perps/Entry';
import PredictionScreen from '@/screens/Prediction';

type AnyProps = Record<string, unknown>;

export const LendingScreenWithPreload = (props: AnyProps) => {
  const strategy = useInnerDappPreloadStrategy();
  return (
    <View style={styles.container}>
      <AAVEScreen {...props} />
      {strategy === 'screen' ? <InnerDappWebViewPreloadLayer /> : null}
    </View>
  );
};

export const PerpsScreenWithPreload = (props: AnyProps) => {
  const strategy = useInnerDappPreloadStrategy();
  return (
    <View style={styles.container}>
      <PerpsScreen {...props} />
      {strategy === 'screen' ? <InnerDappWebViewPreloadLayer /> : null}
    </View>
  );
};

export const PredictionScreenWithPreload = (props: AnyProps) => {
  const strategy = useInnerDappPreloadStrategy();
  return (
    <View style={styles.container}>
      <PredictionScreen {...props} />
      {strategy === 'screen' ? <InnerDappWebViewPreloadLayer /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

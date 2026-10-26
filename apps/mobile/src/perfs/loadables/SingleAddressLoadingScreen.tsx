import React, { useLayoutEffect } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';

import {
  ensureFeatureActivation,
  markFeatureActivation,
} from '@/core/utils/featureActivationDiagnostics';

export function SingleAddressLoadingScreen() {
  const colorScheme = useColorScheme();

  useLayoutEffect(() => {
    const cycleId = ensureFeatureActivation(
      'single-address',
      'single_address_loading_fallback',
    );
    markFeatureActivation('single-address', 'route-shell-mounted', {
      cycleId,
      reason: 'lazy_single_address_content',
    });
  }, []);

  return (
    <View
      testID="single-address-route-shell"
      style={[
        styles.container,
        colorScheme === 'dark' ? styles.containerDark : styles.containerLight,
      ]}>
      <ActivityIndicator color="#7084ff" size="small" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  containerDark: {
    backgroundColor: '#111214',
  },
  containerLight: {
    backgroundColor: '#f5f6f8',
  },
});

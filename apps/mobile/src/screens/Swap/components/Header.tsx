import React, { useMemo } from 'react';
import { RcIconSwapHistory, RcIconSwapSettings } from '@/assets/icons/swap';
import { View } from 'react-native';
import TouchableView from '@/components/Touchable/TouchableView';
import { createGetStyles } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';
import { SwapTxHistory } from './SwapTxHistory';
import { useSwapTxHistoryVisible } from '../hooks/history';
import { TradingSettings } from './TradingSettings';
import { useSwapSettingsVisible } from '../hooks';

export const SwapHeader = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const { setVisible } = useSwapTxHistoryVisible();
  const { setVisible: setHistoryVisible } = useSwapSettingsVisible();

  const openSwapHistory = React.useCallback(() => {
    setVisible(true);
  }, [setVisible]);
  const openSwapSetting = React.useCallback(() => {
    setHistoryVisible(true);
  }, [setHistoryVisible]);

  return (
    <View style={styles.container}>
      <TouchableView onPress={openSwapHistory}>
        <RcIconSwapHistory style={styles.icon} />
      </TouchableView>
      <TouchableView onPress={openSwapSetting}>
        <RcIconSwapSettings style={styles.icon} />
      </TouchableView>
      <SwapTxHistory />
      <TradingSettings />
    </View>
  );
};

const getStyles = createGetStyles(colors => ({
  container: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
  },
  icon: {
    width: 24,
    height: 24,
  },
}));

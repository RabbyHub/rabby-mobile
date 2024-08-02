import { RcIconSwapHistory } from '@/assets/icons/swap';
import TouchableView from '@/components/Touchable/TouchableView';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useSwapTxHistoryVisible } from '../hooks/history';
import { SwapTxHistory } from './SwapTxHistory';

export const SwapHeader = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const { setVisible } = useSwapTxHistoryVisible();

  const openSwapHistory = React.useCallback(() => {
    setVisible(true);
  }, [setVisible]);

  return (
    <View style={styles.container}>
      <TouchableView onPress={openSwapHistory}>
        <RcIconSwapHistory style={styles.icon} />
      </TouchableView>
      <SwapTxHistory />
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

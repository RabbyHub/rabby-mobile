import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import {
  usePollSwapPendingNumber,
  useSwapTxHistoryVisible,
} from '../hooks/history';
import { SwapTxHistory } from './SwapTxHistory';
import PendingTx from '@/screens/Bridge/components/PendingTx';
import RcIconSwapHistory from '@/assets2024/icons/bridge/IconTopHistory.svg';
import { createGetStyles2024 } from '@/utils/styles';

export const SwapHeader = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const loadingNumber = usePollSwapPendingNumber(5000);

  const { setVisible } = useSwapTxHistoryVisible();

  const openSwapHistory = React.useCallback(() => {
    setVisible(true);
  }, [setVisible]);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={openSwapHistory}>
        {loadingNumber ? (
          <PendingTx number={loadingNumber} onClick={openSwapHistory} />
        ) : (
          <RcIconSwapHistory
            style={styles.icon}
            color={colors2024['neutral-body']}
          />
        )}
      </TouchableOpacity>
      <SwapTxHistory />
    </View>
  );
};

const getStyle = createGetStyles2024(() => ({
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

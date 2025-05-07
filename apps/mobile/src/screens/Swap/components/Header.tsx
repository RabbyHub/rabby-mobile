import RcIconSwapHistory from '@/assets2024/icons/common/IconHistoryCC.svg';
import { useTheme2024 } from '@/hooks/theme';
import PendingTx from '@/screens/Bridge/components/PendingTx';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useReadPendingCount, useSwapTxHistoryVisible } from '../hooks/history';
import { SwapTxHistory } from './SwapTxHistory';

export const SwapHeader = ({
  isForMultipleAdderss,
}: {
  isForMultipleAdderss: boolean;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const loadingNumber = useReadPendingCount();

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
      <SwapTxHistory isForMultipleAdderss={isForMultipleAdderss} />
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
    width: 22,
    height: 22,
  },
}));

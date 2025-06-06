import RcIconSwapHistory from '@/assets2024/icons/common/IconHistoryCC.svg';
import { useTheme2024 } from '@/hooks/theme';
import PendingTx from '@/screens/Bridge/components/PendingTx';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useEffect } from 'react';
import { TouchableOpacity, View } from 'react-native';
import {
  useReadPendingCount,
  useReadSwapHistoryRedDot,
  useSwapTxHistoryVisible,
} from '../hooks/history';
import { SwapTxHistory } from './SwapTxHistory';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';

export const SwapHeader = ({
  isForMultipleAddress,
  clearSwapHistoryRedDot,
}: {
  isForMultipleAddress: boolean;
  clearSwapHistoryRedDot: () => number;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [recentShowTime, setRecentShowTime] = React.useState<number>(0);

  const loadingNumber = useReadPendingCount();
  const showRedDot = useReadSwapHistoryRedDot();

  const { visible, setVisible } = useSwapTxHistoryVisible();

  const openSwapHistory = React.useCallback(() => {
    setVisible(true);
    const currentTs = clearSwapHistoryRedDot();
    if (currentTs) {
      setRecentShowTime(currentTs);
    }
  }, [setVisible, clearSwapHistoryRedDot]);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={openSwapHistory} style={styles.iconContainer}>
        <RcIconSwapHistory
          style={styles.icon}
          color={colors2024['neutral-body']}
        />
        {/* not very accurate */}
        {/* {Boolean(showRedDot) && <View style={styles.greenDot} />} */}
      </TouchableOpacity>
      <SwapTxHistory
        isForMultipleAddress={isForMultipleAddress}
        recentShowTime={recentShowTime}
      />
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
  },
  iconContainer: {
    position: 'relative',
    padding: 4,
  },
  icon: {
    width: 22,
    height: 22,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors2024['green-default'],
    position: 'absolute',
    top: 0,
    right: 0,
  },
}));

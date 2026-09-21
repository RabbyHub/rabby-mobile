import RcIconSwapHistory from '@/assets2024/icons/common/IconHistoryCC.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import {
  useClearSwapHistoryRedDot,
  useSwapTxHistoryVisible,
} from '../hooks/history';
import { SwapTxHistory } from './SwapTxHistory';

export const SwapHeader = ({
  isForMultipleAddress,
  clearSwapHistoryRedDot,
}: {
  isForMultipleAddress: boolean;
  clearSwapHistoryRedDot?: () => number | Promise<number>;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [recentShowTime, setRecentShowTime] = React.useState<number>(0);
  const clearSwapHistoryRedDotFromScene = useClearSwapHistoryRedDot();

  const { setVisible } = useSwapTxHistoryVisible();

  const openSwapHistory = React.useCallback(async () => {
    setVisible(true);
    const currentTs = (
      clearSwapHistoryRedDot || clearSwapHistoryRedDotFromScene
    )();
    const resolvedCurrentTs = await currentTs;
    if (resolvedCurrentTs) {
      setRecentShowTime(resolvedCurrentTs);
    }
  }, [setVisible, clearSwapHistoryRedDot, clearSwapHistoryRedDotFromScene]);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={openSwapHistory} style={styles.iconContainer}>
        <RcIconSwapHistory
          style={styles.icon}
          color={colors2024['neutral-body']}
        />
      </TouchableOpacity>
      <SwapTxHistory
        isForMultipleAddress={isForMultipleAddress}
        recentShowTime={recentShowTime}
      />
    </View>
  );
};

const getStyle = createGetStyles2024(() => ({
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
}));

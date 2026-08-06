import React, {
  useCallback,
  useState,
  useImperativeHandle,
  type Ref,
} from 'react';
import {
  useClearBridgeHistoryRedDot,
  useSetSettingVisible,
  useSettingVisible,
} from '../hooks';
import { BridgeTxHistory } from './BridgeHistory';
import { RabbyFeePopup } from '@/components/RabbyFeePopup';
import { Keyboard, TouchableOpacity, View } from 'react-native';
import RcIconSwapHistory from '@/assets2024/icons/common/IconHistoryCC.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

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
  iconContainer: {
    position: 'relative',
    padding: 4,
  },
}));
export interface BridgeHeaderRef {
  openHistory: () => void;
}

export const BridgeHeader = ({
  clearBridgeHistoryRedDot,
  ref,
}: {
  clearBridgeHistoryRedDot?: () => number | Promise<number>;
  ref?: Ref<BridgeHeaderRef>;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const clearBridgeHistoryRedDotFromScene = useClearBridgeHistoryRedDot();

  const feePopupVisible = useSettingVisible();
  const setFeePopupVisible = useSetSettingVisible();
  const [recentShowTime, setRecentShowTime] = React.useState<number>(0);
  const [historyVisible, setHistoryVisible] = useState(false);

  const closeHistory = useCallback(() => {
    setHistoryVisible(false);
  }, []);

  const openHistory = useCallback(async () => {
    Keyboard.dismiss();
    setHistoryVisible(true);
    const currentTs = (
      clearBridgeHistoryRedDot || clearBridgeHistoryRedDotFromScene
    )();
    const resolvedCurrentTs = await currentTs;
    if (resolvedCurrentTs) {
      setRecentShowTime(resolvedCurrentTs);
    }
  }, [clearBridgeHistoryRedDot, clearBridgeHistoryRedDotFromScene]);

  const closeFeePopup = useCallback(() => {
    setFeePopupVisible(false);
  }, [setFeePopupVisible]);

  useImperativeHandle(
    ref,
    () => ({
      openHistory,
    }),
    [openHistory],
  );

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity onPress={openHistory} style={styles.iconContainer}>
          <RcIconSwapHistory color={colors2024['neutral-body']} />
        </TouchableOpacity>
      </View>

      <BridgeTxHistory
        visible={historyVisible}
        onClose={closeHistory}
        recentShowTime={recentShowTime}
      />
      <RabbyFeePopup
        type="bridge"
        visible={feePopupVisible}
        onClose={closeFeePopup}
      />
    </>
  );
};

import React, {
  useCallback,
  useMemo,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  useReadBridgeHistoryRedDot,
  useReadBridgePendingCount,
  useSetSettingVisible,
  useSettingVisible,
} from '../hooks';
import TouchableView from '@/components/Touchable/TouchableView';
import { BridgeTxHistory } from './BridgeHistory';
import { RabbyFeePopup } from '@/components/RabbyFeePopup';
import { Keyboard, TouchableOpacity, View } from 'react-native';
// import { RcIconSwapHistory } from '@/assets/icons/swap';
import RcIconSwapHistory from '@/assets2024/icons/common/IconHistoryCC.svg';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { createGetStyles, createGetStyles2024 } from '@/utils/styles';
import PendingTx from './PendingTx';

const getStyle = createGetStyles2024(({ colors, colors2024 }) => ({
  container: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
  },
  icon: {
    width: 24,
    height: 24,
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
  iconContainer: {
    position: 'relative',
    padding: 4,
  },
}));
export interface BridgeHeaderRef {
  openHistory: () => void;
}

export const BridgeHeader = forwardRef<
  BridgeHeaderRef,
  {
    clearBridgeHistoryRedDot: () => number;
  }
>(({ clearBridgeHistoryRedDot }, ref) => {
  const { styles, colors, colors2024 } = useTheme2024({ getStyle });

  const feePopupVisible = useSettingVisible();
  const setFeePopupVisible = useSetSettingVisible();
  const [recentShowTime, setRecentShowTime] = React.useState<number>(0);
  const [historyVisible, setHistoryVisible] = useState(false);

  const showRedDot = useReadBridgeHistoryRedDot();
  const loadingNumber = useReadBridgePendingCount();

  const closeHistory = useCallback(() => {
    setHistoryVisible(false);
  }, []);

  const openHistory = useCallback(() => {
    Keyboard.dismiss();
    setHistoryVisible(true);
    const currentTs = clearBridgeHistoryRedDot();
    if (currentTs) {
      setRecentShowTime(currentTs);
    }
  }, [clearBridgeHistoryRedDot]);

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
          {/* not very accurate */}
          {/* {Boolean(showRedDot) && <View style={styles.greenDot} />} */}
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
});

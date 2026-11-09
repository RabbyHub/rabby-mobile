import React, {
  useCallback,
  useState,
  useImperativeHandle,
  useEffect,
  type Ref,
} from 'react';
import {
  useClearBridgeHistoryRedDot,
  useSetSettingVisible,
  useSettingVisible,
} from '../hooks';
import { BridgeTxHistory } from './BridgeHistory';
import { RabbyFeePopup } from '@/components/RabbyFeePopup';
import { CompareFee } from '@/components/RabbyFeePopup/CompareFee';
import { Keyboard, TouchableOpacity, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useRoute } from '@react-navigation/native';
import RcIconSwapHistory from '@/assets2024/icons/common/IconHistoryCC.svg';
import RcIconHistoryPendingBlue from '@/assets2024/icons/bridge/IconHistoryPendingBlue.svg';
import RcIconHistoryPendingYellow from '@/assets2024/icons/bridge/IconHistoryPendingYellow.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { useBridgeHistoryPendingStore } from '../hooks/historyPending';

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
  pendingIcon: {
    width: 24,
    height: 24,
    // Figma 图形的圆心偏离 24×24 画布中心。
    transformOrigin: [12.8568, 12.8555, 0],
  },
  iconContainer: {
    position: 'relative',
    padding: 4,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
export interface BridgeHeaderRef {
  openHistory: () => void;
}

export const BridgeHeader = ({
  clearBridgeHistoryRedDot,
  isForMultipleAddress = false,
  ref,
}: {
  clearBridgeHistoryRedDot?: () => number | Promise<number>;
  isForMultipleAddress?: boolean;
  ref?: Ref<BridgeHeaderRef>;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const clearBridgeHistoryRedDotFromScene = useClearBridgeHistoryRedDot();
  const route = useRoute();
  const { finalSceneCurrentAccount: account } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const sceneKey = `${route.key}:${account?.address.toLowerCase() || ''}`;
  const pending = useBridgeHistoryPendingStore(
    state => state.pendingByScene[sceneKey] ?? null,
  );
  const spinning = !!pending;
  const rotation = useSharedValue(0);
  const rotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  useEffect(() => {
    if (!spinning) {
      return;
    }
    rotation.value = 0;
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 1500,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    return () => cancelAnimation(rotation);
  }, [spinning, rotation]);

  const {
    visible: feePopupVisible,
    compareVisible,
    feeTier,
  } = useSettingVisible();
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
    setFeePopupVisible(prev =>
      prev.visible ? { visible: false, compareVisible: false } : prev,
    );
  }, [setFeePopupVisible]);

  const closeCompareFee = useCallback(() => {
    setFeePopupVisible(prev =>
      prev.compareVisible ? { visible: false, compareVisible: false } : prev,
    );
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
          {pending ? (
            <Animated.View style={[styles.pendingIcon, rotationStyle]}>
              {pending === 'processing' ? (
                <RcIconHistoryPendingBlue style={styles.icon} />
              ) : (
                <RcIconHistoryPendingYellow style={styles.icon} />
              )}
            </Animated.View>
          ) : (
            <RcIconSwapHistory color={colors2024['neutral-body']} />
          )}
        </TouchableOpacity>
      </View>

      <BridgeTxHistory
        isForMultipleAddress={isForMultipleAddress}
        visible={historyVisible}
        onClose={closeHistory}
        recentShowTime={recentShowTime}
      />
      <RabbyFeePopup
        type="bridge"
        visible={feePopupVisible}
        feeTier={feeTier}
        onClose={closeFeePopup}
      />
      <CompareFee
        type="bridge"
        visible={compareVisible}
        onClose={closeCompareFee}
      />
    </>
  );
};

import React, { useCallback, useState, useEffect } from 'react';
import { TouchableOpacity, View } from 'react-native';
// import { RcIconSwapHistory } from '@/assets/icons/swap';
import RcIconSwapHistory from '@/assets2024/icons/common/IconHistoryCC.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import PendingTx from '@/screens/Bridge/components/PendingTx';
import { RootNames } from '@/constant/layout';
import { useFocusEffect } from '@react-navigation/native';
import { naviPush } from '@/utils/navigation';
import { eventBus, EVENTS } from '@/utils/events';
import { useInterval } from 'ahooks';
import { transactionHistoryService } from '@/core/services';
import { findChain } from '@/utils/chain';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { CUSTOM_HISTORY_ACTION } from '@/screens/Transaction/components/type';
import { useRefreshHistoryId } from '../hooks';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
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

let preCount = 0;

interface LendingHeaderProps {
  onPendingClear?: () => void;
}
export const LendingHeader = ({ onPendingClear }: LendingHeaderProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const [pendingCount, setPendingCount] = useState(0);
  const { refreshHistoryId } = useRefreshHistoryId();
  const [showGreenDot, setShowGreenDot] = useState(false);
  const { finalSceneCurrentAccount } = useSceneAccountInfo({
    forScene: 'Lending',
  });
  const fetchLocalTx = useCallback(async () => {
    const address = finalSceneCurrentAccount?.address.toLowerCase()!;
    if (!address) {
      return [];
    }
    const { pendings: _pendings } = transactionHistoryService.getList(address);

    const pending = _pendings.filter(item => {
      const chain = findChain({ id: item.chainId });
      const isLendingTx =
        item.customActionInfo?.customAction === CUSTOM_HISTORY_ACTION.LENDING;
      return !chain?.isTestnet && isLendingTx;
    });

    const lendingSuccessHistoryList =
      transactionHistoryService.getLendingSuccessHistoryList(address);
    const lendingSuccessHistoryListCount = lendingSuccessHistoryList.length;
    setShowGreenDot(lendingSuccessHistoryListCount > 0);
    setPendingCount(pending.length);
  }, [finalSceneCurrentAccount?.address]);

  useInterval(() => fetchLocalTx(), pendingCount > 0 ? 5000 : 60 * 1000);

  useFocusEffect(
    useCallback(() => {
      fetchLocalTx();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchLocalTx, refreshHistoryId]),
  );

  useEffect(() => {
    if (pendingCount === 0 && preCount > 0) {
      onPendingClear?.();
    }
    preCount = pendingCount;
  }, [pendingCount, onPendingClear]);

  useEffect(() => {
    eventBus.addListener(EVENTS.RELOAD_TX, fetchLocalTx);
    return () => {
      eventBus.removeListener(EVENTS.RELOAD_TX, fetchLocalTx);
    };
  }, [fetchLocalTx]);

  const openHistory = useCallback(() => {
    // const currentTs = clearBridgeHistoryRedDot();
    // if (currentTs) {
    //   setRecentShowTime(currentTs);
    // }
    naviPush(RootNames.StackTransaction, {
      screen: RootNames.LendingHistory,
      params: {},
    });
  }, []);

  return (
    <>
      <View style={styles.container}>
        {pendingCount > 0 ? (
          <PendingTx number={pendingCount} onClick={openHistory} />
        ) : (
          <TouchableOpacity onPress={openHistory} style={styles.iconContainer}>
            <RcIconSwapHistory color={colors2024['neutral-body']} />
            {/* not very accurate */}
            {Boolean(showGreenDot) && <View style={styles.greenDot} />}
          </TouchableOpacity>
        )}
      </View>
    </>
  );
};

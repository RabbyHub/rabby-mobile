import React, { useCallback, useMemo, useState } from 'react';
import {
  usePollBridgePendingNumber,
  useSetSettingVisible,
  useSettingVisible,
} from '../hooks';
import TouchableView from '@/components/Touchable/TouchableView';
import { BridgeTxHistory } from './BridgeHistory';
import { RabbyFeePopup } from '@/components/RabbyFeePopup';
import { View } from 'react-native';
import { RcIconSwapHistory } from '@/assets/icons/swap';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import PendingTx from './PendingTx';

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

export const BridgeHeader = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const feePopupVisible = useSettingVisible();
  const setFeePopupVisible = useSetSettingVisible();

  const [historyVisible, setHistoryVisible] = useState(false);

  const loadingNumber = usePollBridgePendingNumber();

  const closeHistory = useCallback(() => {
    setHistoryVisible(false);
  }, []);

  const openHistory = useCallback(() => {
    setHistoryVisible(true);
  }, []);

  const closeFeePopup = useCallback(() => {
    setFeePopupVisible(false);
  }, [setFeePopupVisible]);

  return (
    <>
      <View style={styles.container}>
        <TouchableView onPress={openHistory}>
          {loadingNumber ? (
            <PendingTx number={loadingNumber} onClick={openHistory} />
          ) : (
            <RcIconSwapHistory style={styles.icon} />
          )}
        </TouchableView>
      </View>

      <BridgeTxHistory visible={historyVisible} onClose={closeHistory} />
      <RabbyFeePopup
        type="bridge"
        visible={feePopupVisible}
        onClose={closeFeePopup}
      />
    </>
  );
};

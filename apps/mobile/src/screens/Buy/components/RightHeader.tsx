import { useTheme2024 } from '@/hooks/theme';
import React, { useCallback, useState } from 'react';
import { Keyboard, TouchableOpacity, View } from 'react-native';

import PendingTx from '@/screens/Bridge/components/PendingTx';
import RcIconSwapHistory from '@/assets2024/icons/bridge/IconTopHistory.svg';
import { createGetStyles2024 } from '@/utils/styles';
import { usePollBuyPendingNumber } from '../hooks/history';
import { BuyHistory } from './BuyHistory';

export const RightHeader = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const loadingNumber = usePollBuyPendingNumber(5000);

  const [historyVisible, setHistoryVisible] = useState(false);

  const closeHistory = useCallback(() => {
    setHistoryVisible(false);
  }, []);

  const openHistory = useCallback(() => {
    Keyboard.dismiss();
    setHistoryVisible(true);
  }, []);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={openHistory}>
        {loadingNumber ? (
          <PendingTx number={loadingNumber} onClick={openHistory} />
        ) : (
          <RcIconSwapHistory
            style={styles.icon}
            color={colors2024['neutral-body']}
          />
        )}
      </TouchableOpacity>
      <BuyHistory visible={historyVisible} onClose={closeHistory} />
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

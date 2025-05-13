import React, { useCallback, useState } from 'react';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  View,
  StyleProp,
  ViewStyle,
  TouchableOpacity,
  Keyboard,
} from 'react-native';
import RcIconSwapHistory from '@/assets2024/icons/common/IconHistoryCC.svg';
import { SendHistory } from './SendHistory';
import PendingTx from '@/screens/Bridge/components/PendingTx';
import { useReadSendPendingCount } from '../../hooks/useSendPendingCount';

interface IProps {
  isForMultipleAdderss?: boolean;
  style?: StyleProp<ViewStyle>;
}
export const SendHeaderRight = ({
  style,
  isForMultipleAdderss = true,
}: IProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const [historyVisible, setHistoryVisible] = useState(false);

  const closeHistory = useCallback(() => {
    setHistoryVisible(false);
  }, []);

  const openHistory = useCallback(() => {
    Keyboard.dismiss();
    setHistoryVisible(true);
  }, []);

  const loadingNumber = useReadSendPendingCount();

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity onPress={openHistory}>
          {loadingNumber ? (
            <PendingTx number={loadingNumber} onClick={openHistory} />
          ) : (
            <RcIconSwapHistory color={colors2024['neutral-body']} />
          )}
        </TouchableOpacity>
      </View>

      <SendHistory
        isForMultipleAdderss={isForMultipleAdderss}
        visible={historyVisible}
        onClose={closeHistory}
      />
    </>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
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

import React, { useCallback, useEffect, useState } from 'react';
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
import {
  useReadSendFailTxList,
  useReadSendPendingCount,
  useReadSendSuccessTxList,
} from '../../hooks/useSendPendingCount';
import { useFocusEffect } from '@react-navigation/native';

interface IProps {
  isForMultipleAddress?: boolean;
  style?: StyleProp<ViewStyle>;
}
export const SendHeaderRight = ({
  style,
  isForMultipleAddress = true,
}: IProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const [historyVisible, setHistoryVisible] = useState(false);
  const [isShowDot, setIsShowDot] = useState(false);
  const closeHistory = useCallback(() => {
    setHistoryVisible(false);
  }, []);

  const openHistory = useCallback(() => {
    Keyboard.dismiss();
    setHistoryVisible(true);
    setIsShowDot(false);
  }, []);

  const loadingNumber = useReadSendPendingCount();
  const successTxList = useReadSendSuccessTxList();
  const failTxList = useReadSendFailTxList();

  const updateIsShowDot = useCallback(() => {
    setIsShowDot(Boolean(successTxList.length || failTxList.length));
  }, [successTxList, failTxList]);

  useEffect(() => {
    updateIsShowDot();
  }, [updateIsShowDot]);

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity onPress={openHistory} style={styles.iconContainer}>
          <RcIconSwapHistory color={colors2024['neutral-body']} />
          {/* not very accurate */}
          {/* {Boolean(isShowDot) && <View style={styles.greenDot} />} */}
        </TouchableOpacity>
      </View>

      <SendHistory
        isForMultipleAddress={isForMultipleAddress}
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
  iconContainer: {
    position: 'relative',
    padding: 4,
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
  icon: {
    width: 24,
    height: 24,
  },
}));

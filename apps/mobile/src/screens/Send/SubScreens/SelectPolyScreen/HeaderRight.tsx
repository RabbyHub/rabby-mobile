import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { AddressItem as InnerAddressItem } from '@/components2024/AddressItem/AddressItem';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Card } from '@/components2024/Card';
import {
  StyleSheet,
  View,
  Text,
  StyleProp,
  ViewStyle,
  TouchableOpacity,
  Image,
} from 'react-native';
import RcIconSwapHistory from '@/assets2024/icons/common/IconHistoryCC.svg';
import { useSendRoutes } from '@/hooks/useSendRoutes';
import { SendHistory } from './SendHistory';

interface IProps {
  style?: StyleProp<ViewStyle>;
}
export const SendHeaderRight = ({ style }: IProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const [historyVisible, setHistoryVisible] = useState(false);

  const closeHistory = useCallback(() => {
    setHistoryVisible(false);
  }, []);

  const openHistory = useCallback(() => {
    setHistoryVisible(true);
  }, []);

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity onPress={openHistory}>
          <RcIconSwapHistory color={colors2024['neutral-body']} />
        </TouchableOpacity>
      </View>

      <SendHistory visible={historyVisible} onClose={closeHistory} />
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

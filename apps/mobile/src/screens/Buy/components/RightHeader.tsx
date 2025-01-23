import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';

import PendingTx from '@/screens/Bridge/components/PendingTx';
import RcIconSwapHistory from '@/assets2024/icons/bridge/IconTopHistory.svg';
import { createGetStyles2024 } from '@/utils/styles';

export const RightHeader = ({
  loadingNumber,
  onPress,
}: {
  loadingNumber?: number;
  onPress: () => void;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onPress}>
        {loadingNumber ? (
          <PendingTx number={loadingNumber} onClick={onPress} />
        ) : (
          <RcIconSwapHistory
            style={styles.icon}
            color={colors2024['neutral-body']}
          />
        )}
      </TouchableOpacity>
      {/* <SwapTxHistory /> */}
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

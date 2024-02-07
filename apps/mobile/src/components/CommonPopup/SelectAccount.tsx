import { View, Text } from 'react-native';

import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { MODAL_CREATE_PARMAS } from '../GlobalBottomSheetModal/types';

export default function SelectAccountInner({
  onConfirm
}: MODAL_CREATE_PARMAS['SWITCH_ACCOUNT']) {
  const { styles } = useThemeStyles(getStyles);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Address</Text>
    </View>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    container: {
      flex: 1,
      paddingTop: 20,
    },
    title: {
      color: colors['neutral-title1'],
      textAlign: 'center',
      fontSize: 24,
      fontStyle: 'normal',
      fontWeight: '600',
    },
  };
});

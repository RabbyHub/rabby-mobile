import { View, Text } from 'react-native';

import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { MODAL_CREATE_PARAMS } from '../GlobalBottomSheetModal/types';
import AutoLockView from '../AutoLockView';

export default function SimpleConfirmInner({
  title,
}: MODAL_CREATE_PARAMS['SIMPLE_CONFIRM']) {
  const { styles } = useThemeStyles(getStyles);

  return (
    <AutoLockView style={styles.container}>
      <Text style={styles.title}>{title}</Text>
    </AutoLockView>
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

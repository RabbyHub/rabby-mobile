import { View } from 'react-native';

import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

export default function Button() {
  const { styles } = useTheme2024({ getStyle });

  return <View style={styles.container}></View>;
}

const getStyle = createGetStyles2024(ctx => {
  return {
    container: {
      // fontFamily: 'SF Pro Rounded',
    },
  };
});

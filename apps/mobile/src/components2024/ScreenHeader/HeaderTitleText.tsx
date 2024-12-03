import { Text, TextStyle } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

export default function HeaderTitleText2024({
  children,
  style,
}: React.PropsWithChildren<{ style?: TextStyle }>) {
  const { styles } = useTheme2024({ getStyle });
  return <Text style={[styles.title, style]}>{children}</Text>;
}

const getStyle = createGetStyles2024(ctx => {
  return {
    title: {
      color: ctx.colors2024['neutral-title-1'],
      fontWeight: '800',
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
    },
  };
});

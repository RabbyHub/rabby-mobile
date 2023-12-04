import { useIsFocused } from '@react-navigation/native';
import { StatusBar, StatusBarProps } from 'react-native';

import { useThemeColors, useColorScheme } from '@/hooks/theme';

export const FocusAwareStatusBar = (props: StatusBarProps) => {
  const isFocused = useIsFocused();
  const colors = useThemeColors();
  const isLight = useColorScheme() === 'light';

  return isFocused ? (
    <StatusBar
      backgroundColor={colors['neutral-bg-1']}
      barStyle={isLight ? 'dark-content' : 'light-content'}
      translucent
      {...props}
    />
  ) : null;
};

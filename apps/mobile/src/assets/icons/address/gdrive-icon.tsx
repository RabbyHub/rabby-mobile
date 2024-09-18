import { useThemeColors } from '@/hooks/theme';
import { Svg, Rect, Path } from 'react-native-svg';

export const GDriveIcon = () => {
  const colors = useThemeColors();
  return (
    <Svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <Rect width="32" height="32" rx="16" fill={colors['neutral-card2']} />
      <Path
        d="M16 13L10 23L7 18L13 8L16 13Z"
        stroke={colors['neutral-body']}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13 18H25L22 23H10"
        stroke={colors['neutral-body']}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M19 18L13 8H19L25 18H19Z"
        stroke={colors['neutral-body']}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
